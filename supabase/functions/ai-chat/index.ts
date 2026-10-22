// Supabase Edge Function: ai-chat
//
// The shop's AI assistant. Works FREE without any key (built-in bot), or with a free Gemini / Groq key
// for a real AI, or with a paid Claude key. See "AI providers" below.
//   mode "customer": answers shoppers - products, prices, sizes, delivery charges, order tracking.
//   mode "admin":    helps the owner - sales summary, orders, low stock, and simple changes
//                    (order status, mark paid, stock, price). Needs a logged-in admin (x-admin-token).
//
// Secrets (Supabase > Edge Functions > Secrets) - all optional:
//   GEMINI_API_KEY (free), GROQ_API_KEY (free), ANTHROPIC_API_KEY (paid), AI_PROVIDER
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-region, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const money = (n: unknown) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');

// ---------------- tools ----------------
const CUSTOMER_TOOLS = [
  {
    name: 'search_products',
    description: 'Find products in the shop by name, brand, category or use. Returns name, price, old price, sizes, stock status and link.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'words to look for, e.g. "keratin shampoo" or "hair color"' } }, required: ['query'] },
  },
  {
    name: 'list_categories',
    description: 'List the product categories of the shop with how many products each has.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'delivery_info',
    description: 'Delivery charge and payment options (Cash on Delivery or online) for a city in Pakistan.',
    input_schema: { type: 'object', properties: { city: { type: 'string' }, province: { type: 'string' } }, required: ['city'] },
  },
  {
    name: 'track_order',
    description: 'Status of a customer order. Needs the order number and the last 4 digits of the mobile number used for the order.',
    input_schema: {
      type: 'object',
      properties: { order_number: { type: 'string' }, phone_last4: { type: 'string' } },
      required: ['order_number', 'phone_last4'],
    },
  },
];

const ADMIN_TOOLS = [
  ...CUSTOMER_TOOLS.filter((t) => t.name !== 'track_order'),
  {
    name: 'sales_summary',
    description: 'Orders and sales for the last N days: count, total, by status, by city, by payment method.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'e.g. 1 for today, 7, 30' } }, required: ['days'] },
  },
  {
    name: 'list_orders',
    description: 'Latest orders, optionally filtered by status (Pending, Confirmed, Shipped, Delivered, Cancelled), city, or unpaid online payments.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string' }, city: { type: 'string' },
        unpaid_online_only: { type: 'boolean' }, limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_order',
    description: 'Full details of one order by order number (customer, address, items, payment details).',
    input_schema: { type: 'object', properties: { order_number: { type: 'string' } }, required: ['order_number'] },
  },
  {
    name: 'update_order_status',
    description: 'Change the status of an order. Only when the admin asks for it.',
    input_schema: {
      type: 'object',
      properties: { order_number: { type: 'string' }, status: { type: 'string', enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] } },
      required: ['order_number', 'status'],
    },
  },
  {
    name: 'mark_order_paid',
    description: 'Record that the full amount of an order has been received. Only when the admin asks for it.',
    input_schema: { type: 'object', properties: { order_number: { type: 'string' }, note: { type: 'string' } }, required: ['order_number'] },
  },
  {
    name: 'low_stock',
    description: 'Products (and sizes) with little or no stock.',
    input_schema: { type: 'object', properties: { max_stock: { type: 'number', description: 'default 5' } } },
  },
  {
    name: 'update_stock',
    description: 'Set the stock of a product (or of one size of it). Only when the admin asks for it.',
    input_schema: {
      type: 'object',
      properties: { product: { type: 'string', description: 'product name' }, size: { type: 'string' }, stock: { type: 'number' } },
      required: ['product', 'stock'],
    },
  },
  {
    name: 'update_price',
    description: 'Set the selling price (and optionally the old/crossed price) of a product or one size. Only when the admin asks for it.',
    input_schema: {
      type: 'object',
      properties: { product: { type: 'string' }, size: { type: 'string' }, price: { type: 'number' }, old_price: { type: 'number' } },
      required: ['product', 'price'],
    },
  },
  {
    name: 'find_customers',
    description: 'Find customers by name, phone, email or city; shows their order count and amount spent.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
];

function deliveryFor(st: any, province: string, city: string) {
  if (String(city).trim().toLowerCase() === 'karachi') return Number(st.delivery_karachi ?? 0);
  const r = st.delivery_rates && province ? st.delivery_rates[province] : undefined;
  return r !== undefined && r !== null && !isNaN(Number(r)) ? Number(r) : Number(st.delivery_other ?? 250);
}

async function findProduct(sb: any, name: string) {
  const { data } = await sb.from('products').select('*').ilike('name', `%${name.replace(/[%_]/g, '')}%`).limit(5);
  if (!data || data.length === 0) return { error: `No product found for "${name}".` };
  if (data.length > 1) {
    const exact = data.find((p: any) => p.name.toLowerCase() === name.toLowerCase());
    if (exact) return { product: exact };
    return { error: 'More than one product matches. Which one?', matches: data.map((p: any) => p.name) };
  }
  return { product: data[0] };
}

async function runTool(sb: any, name: string, input: any, ctx: { site: string; store: any }) {
  const st = ctx.store || {};
  switch (name) {
    case 'search_products': {
      const words = String(input.query || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
      const { data } = await sb.from('products').select('id,name,description,category_name,price,discounted_price,original_price,stock_quantity,variants');
      const scored = (data || []).map((p: any) => {
        const hay = `${p.name} ${p.category_name || ''} ${p.description || ''}`.toLowerCase();
        return { p, s: words.reduce((t: number, w: string) => t + (hay.includes(w) ? (p.name.toLowerCase().includes(w) ? 2 : 1) : 0), 0) };
      }).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 8);
      return scored.map(({ p }: any) => ({
        name: p.name,
        category: p.category_name,
        price: money(p.discounted_price || p.price),
        old_price: Number(p.original_price) > Number(p.discounted_price || p.price) ? money(p.original_price) : undefined,
        sizes: Array.isArray(p.variants) && p.variants.length
          ? p.variants.map((v: any) => `${v.name}: ${money(v.price)}${Number(v.stock) > 0 ? '' : ' (sold out)'}`) : undefined,
        in_stock: Number(p.stock_quantity) > 0,
        link: `${ctx.site}/?product=${p.id}`,
        about: String(p.description || '').slice(0, 200),
      }));
    }
    case 'list_categories': {
      const { data: cats } = await sb.from('categories').select('name');
      const { data: prods } = await sb.from('products').select('category_name');
      return (cats || []).map((c: any) => ({ name: c.name, products: (prods || []).filter((p: any) => p.category_name === c.name).length }));
    }
    case 'delivery_info': {
      const city = String(input.city || '');
      const charge = deliveryFor(st, String(input.province || ''), city);
      const free = Number(st.free_delivery_over || 0);
      const codOk = st.cod_karachi_only === false || city.trim().toLowerCase() === 'karachi';
      return {
        city, delivery_charge: charge > 0 ? money(charge) : 'FREE',
        free_delivery_from: free > 0 ? money(free) : 'no free-delivery offer',
        cash_on_delivery: codOk ? 'available' : 'not available - online payment (EasyPaisa / JazzCash / bank) needed',
      };
    }
    case 'track_order': {
      const no = String(input.order_number || '').trim();
      const { data: o } = await sb.from('orders').select('*').ilike('invoice_no', no).maybeSingle();
      if (!o || digits(o.customer_phone).slice(-4) !== digits(input.phone_last4).slice(-4)) {
        return { error: 'No order found with this number and phone. Please check both.' };
      }
      const { data: items } = await sb.from('order_items').select('product_name,quantity').eq('order_id', o.id);
      return {
        order_number: o.invoice_no, placed_on: o.created_at, status: o.status || 'Pending',
        payment: o.payment_status === 'Paid' ? 'paid' : (o.payment_method === 'cod' ? 'cash on delivery' : 'payment being checked'),
        total: money(o.total_amount), items: (items || []).map((i: any) => `${i.quantity} x ${i.product_name}`),
        courier: o.courier || undefined, tracking_no: o.tracking_no || undefined,
        courier_tracking_link: o.tracking_url || (o.courier && o.tracking_no ? `https://www.google.com/search?q=${encodeURIComponent(o.courier + ' tracking ' + o.tracking_no)}` : undefined),
        track_page: `${ctx.site}/?track=${encodeURIComponent(o.invoice_no)}`,
        invoice_link: `${ctx.site}/?invoice=${o.id}`,
      };
    }
    case 'sales_summary': {
      const days = Math.max(1, Math.min(365, Number(input.days) || 1));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await sb.from('orders').select('total_amount,status,city,payment_method,payment_status,created_at').gte('created_at', since);
      const list = (data || []).filter((o: any) => o.status !== 'Cancelled');
      const by = (k: string) => list.reduce((m: any, o: any) => { const key = o[k] || 'unknown'; m[key] = (m[key] || 0) + 1; return m; }, {});
      return {
        days, orders: list.length, cancelled: (data || []).length - list.length,
        sales_total: money(list.reduce((t: number, o: any) => t + Number(o.total_amount || 0), 0)),
        by_status: by('status'), by_city: by('city'), by_payment: by('payment_method'),
        unpaid_online: list.filter((o: any) => o.payment_method !== 'cod' && o.payment_status !== 'Paid').length,
      };
    }
    case 'list_orders': {
      let q = sb.from('orders').select('invoice_no,created_at,customer_name,customer_phone,city,total_amount,status,payment_method,payment_status')
        .order('created_at', { ascending: false }).limit(Math.min(50, Number(input.limit) || 15));
      if (input.status) q = q.eq('status', input.status);
      if (input.city) q = q.ilike('city', input.city);
      if (input.unpaid_online_only) q = q.neq('payment_method', 'cod').neq('payment_status', 'Paid');
      const { data } = await q;
      return data || [];
    }
    case 'get_order': {
      const { data: o } = await sb.from('orders').select('*').ilike('invoice_no', String(input.order_number || '').trim()).maybeSingle();
      if (!o) return { error: 'Order not found.' };
      const { data: items } = await sb.from('order_items').select('product_name,quantity,unit_price').eq('order_id', o.id);
      const { has_payment_proof, ...rest } = o;
      return { ...rest, payment_screenshot: has_payment_proof ? 'yes (see Admin > Orders)' : 'no', items: items || [] };
    }
    case 'update_order_status': {
      const { data: o } = await sb.from('orders').select('id,invoice_no').ilike('invoice_no', String(input.order_number || '').trim()).maybeSingle();
      if (!o) return { error: 'Order not found.' };
      const patch: any = { status: input.status, delivered_at: input.status === 'Delivered' ? new Date().toISOString() : null };
      const { error } = await sb.from('orders').update(patch).eq('id', o.id);
      return error ? { error: error.message } : { done: `Order ${o.invoice_no} is now ${input.status}.` };
    }
    case 'mark_order_paid': {
      const { data: o } = await sb.from('orders').select('*').ilike('invoice_no', String(input.order_number || '').trim()).maybeSingle();
      if (!o) return { error: 'Order not found.' };
      const due = Number(o.total_amount || 0) - Number(o.paid_amount || 0);
      if (due > 0) {
        await sb.from('payments').insert([{
          order_id: o.id, amount: due, method: o.payment_method, category: o.payment_method === 'cod' ? 'Cash' : 'Online',
          reference: o.transaction_id, note: input.note || 'Marked paid by AI assistant', received_at: new Date().toISOString(),
        }]);
      }
      const { error } = await sb.from('orders').update({ paid_amount: o.total_amount, payment_status: 'Paid', paid_at: new Date().toISOString() }).eq('id', o.id);
      return error ? { error: error.message } : { done: `Order ${o.invoice_no} marked as paid (${money(o.total_amount)}).` };
    }
    case 'low_stock': {
      const max = Number(input.max_stock ?? 5);
      const { data } = await sb.from('products').select('name,stock_quantity,variants');
      const out: any[] = [];
      (data || []).forEach((p: any) => {
        if (Array.isArray(p.variants) && p.variants.length) {
          p.variants.forEach((v: any) => { if (Number(v.stock) <= max) out.push({ product: p.name, size: v.name, stock: Number(v.stock) }); });
        } else if (Number(p.stock_quantity) <= max) out.push({ product: p.name, stock: Number(p.stock_quantity) });
      });
      return out.sort((a, b) => a.stock - b.stock);
    }
    case 'update_stock':
    case 'update_price': {
      const found: any = await findProduct(sb, String(input.product || ''));
      if (!found.product) return found;
      const p = found.product;
      const vs = Array.isArray(p.variants) ? p.variants : [];
      if (vs.length) {
        const size = String(input.size || '');
        const v = vs.find((x: any) => x.name.toLowerCase() === size.toLowerCase());
        if (!v) return { error: `Please say which size: ${vs.map((x: any) => x.name).join(', ')}` };
        if (name === 'update_stock') v.stock = Math.max(0, Math.round(Number(input.stock)));
        else { v.price = Number(input.price); if (input.old_price) v.original_price = Number(input.old_price); }
        const cheapest = vs.slice().sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
        const { error } = await sb.from('products').update({
          variants: vs, stock_quantity: vs.reduce((t: number, x: any) => t + Number(x.stock || 0), 0),
          price: cheapest.price, discounted_price: cheapest.price, original_price: cheapest.original_price || cheapest.price,
        }).eq('id', p.id);
        return error ? { error: error.message } : { done: `${p.name} (${v.name}) updated.` };
      }
      const patch: any = name === 'update_stock'
        ? { stock_quantity: Math.max(0, Math.round(Number(input.stock))) }
        : { price: Number(input.price), discounted_price: Number(input.price), ...(input.old_price ? { original_price: Number(input.old_price) } : {}) };
      const { error } = await sb.from('products').update(patch).eq('id', p.id);
      return error ? { error: error.message } : { done: `${p.name} updated.` };
    }
    case 'find_customers': {
      const q = String(input.query || '').replace(/[%_,()]/g, '');
      const { data } = await sb.from('customers').select('id,name,email,phone_code,phone,city,area,created_at')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`).limit(10);
      const out = [];
      for (const c of data || []) {
        const { data: os } = await sb.from('orders').select('total_amount,status').eq('customer_id', c.id);
        const live = (os || []).filter((o: any) => o.status !== 'Cancelled');
        out.push({ ...c, orders: live.length, spent: money(live.reduce((t: number, o: any) => t + Number(o.total_amount || 0), 0)) });
      }
      return out;
    }
  }
  return { error: 'Unknown tool' };
}

// ======================= AI providers =======================
// The first one that has a key is used. With no key at all, the free built-in bot answers.
//   GEMINI_API_KEY    (free key: https://aistudio.google.com/apikey)       model: GEMINI_MODEL, default gemini-flash-latest
//   GROQ_API_KEY      (free key: https://console.groq.com/keys)           model: GROQ_MODEL, default llama-3.3-70b-versatile
//   ANTHROPIC_API_KEY (paid:     https://console.anthropic.com)          model: AI_MODEL, default claude-haiku-5-5
//   AI_PROVIDER       optional: "gemini" | "groq" | "claude" | "builtin" to choose one

type Ctx = { sb: any; site: string; store: any };
type Hist = { role: 'user' | 'assistant'; content: string }[];

async function callTool(ctx: Ctx, name: string, input: any) {
  try { return await runTool(ctx.sb, name, input || {}, { site: ctx.site, store: ctx.store }); }
  catch (e) { return { error: String(e) }; }
}

// ---- Google Gemini (free tier) ----
function geminiSchema(s: any): any {
  if (!s || typeof s !== 'object') return s;
  const out: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'type') out.type = String(v).toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v as any).map(([pk, pv]) => [pk, geminiSchema(pv)]));
    else out[k] = v;
  }
  return out;
}

async function runGemini(key: string, system: string, tools: any[], history: Hist, ctx: Ctx) {
  // Google retires model names from time to time; try the newest 'latest' alias first and move on if a name is gone (404)
  const models = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'].filter(Boolean) as string[];
  let mi = 0;
  const decl = tools.map((t) => {
    const hasProps = t.input_schema && t.input_schema.properties && Object.keys(t.input_schema.properties).length > 0;
    return hasProps ? { name: t.name, description: t.description, parameters: geminiSchema(t.input_schema) } : { name: t.name, description: t.description };
  });
  const contents: any[] = history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  for (let step = 0; step < 6; step++) {
    const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${models[mi]}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ functionDeclarations: decl }] }),
    });
    let r = await call();
    while (mi < models.length - 1 && (r.status === 503 || r.status === 500 || ((r.status === 404 || r.status === 400) && /model|not found|no longer available/i.test(await r.clone().text())))) {
      mi++;
      r = await call();
    }
    if (!r.ok) {
      const t = await r.text();
      return { error: `Gemini error (${r.status}). ${r.status === 429 ? 'Free daily limit reached - try again later.' : t.slice(0, 200)}` };
    }
    const res = await r.json();
    const parts = (res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts) || [];
    const calls = parts.filter((p: any) => p.functionCall);
    if (!calls.length) {
      return { reply: parts.map((p: any) => p.text || '').join('').trim() || 'Sorry, please ask again.' };
    }
    contents.push({ role: 'model', parts });
    const responses = [];
    for (const p of calls) {
      const out = await callTool(ctx, p.functionCall.name, p.functionCall.args);
      responses.push({ functionResponse: { name: p.functionCall.name, response: { result: out } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return { reply: 'Sorry, I could not finish that. Please ask in a simpler way.' };
}

// ---- Groq (free tier, OpenAI-style API) ----
async function runGroq(key: string, system: string, tools: any[], history: Hist, ctx: Ctx) {
  const model = Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile';
  const messages: any[] = [{ role: 'system', content: system }, ...history];
  const fns = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  for (let step = 0; step < 6; step++) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, tools: fns, tool_choice: 'auto', max_tokens: 1024, temperature: 0.3 }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { error: `Groq error (${r.status}). ${r.status === 429 ? 'Free limit reached - try again in a minute.' : t.slice(0, 200)}` };
    }
    const res = await r.json();
    const msg = res.choices && res.choices[0] && res.choices[0].message;
    if (!msg) return { reply: 'Sorry, please ask again.' };
    if (!msg.tool_calls || !msg.tool_calls.length) return { reply: (msg.content || '').trim() || 'Sorry, please ask again.' };
    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
      const out = await callTool(ctx, tc.function.name, args);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 12000) });
    }
  }
  return { reply: 'Sorry, I could not finish that. Please ask in a simpler way.' };
}

// ---- Claude (Anthropic, paid) ----
async function runClaude(key: string, system: string, tools: any[], history: Hist, ctx: Ctx) {
  const model = Deno.env.get('AI_MODEL') || 'claude-haiku-5-5';
  const messages: any[] = [...history];
  for (let step = 0; step < 6; step++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1024, system, tools, messages }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { error: `AI service error (${r.status}). ${r.status === 401 ? 'Check the ANTHROPIC_API_KEY.' : t.slice(0, 200)}` };
    }
    const res = await r.json();
    const content = res.content || [];
    if (res.stop_reason !== 'tool_use') {
      return { reply: content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim() || '...' };
    }
    messages.push({ role: 'assistant', content });
    const results = [];
    for (const c of content) {
      if (c.type !== 'tool_use') continue;
      const out = await callTool(ctx, c.name, c.input);
      results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'Sorry, I could not finish that. Please ask in a simpler way.' };
}

// ---- Free built-in bot (no key, no AI): understands common questions by keywords ----
const CITY_PROVINCE: Record<string, string> = {
  karachi: 'Sindh', hyderabad: 'Sindh', sukkur: 'Sindh', larkana: 'Sindh', nawabshah: 'Sindh', mirpurkhas: 'Sindh', thatta: 'Sindh', badin: 'Sindh', dadu: 'Sindh', jacobabad: 'Sindh', khairpur: 'Sindh', shikarpur: 'Sindh',
  lahore: 'Punjab', faisalabad: 'Punjab', rawalpindi: 'Punjab', pindi: 'Punjab', gujranwala: 'Punjab', multan: 'Punjab', sialkot: 'Punjab', bahawalpur: 'Punjab', sargodha: 'Punjab', sheikhupura: 'Punjab', 'rahim yar khan': 'Punjab', jhang: 'Punjab', gujrat: 'Punjab', sahiwal: 'Punjab', okara: 'Punjab', kasur: 'Punjab', jhelum: 'Punjab', murree: 'Punjab', 'dera ghazi khan': 'Punjab', chiniot: 'Punjab', wah: 'Punjab', attock: 'Punjab',
  peshawar: 'Khyber Pakhtunkhwa', mardan: 'Khyber Pakhtunkhwa', abbottabad: 'Khyber Pakhtunkhwa', swat: 'Khyber Pakhtunkhwa', mingora: 'Khyber Pakhtunkhwa', kohat: 'Khyber Pakhtunkhwa', nowshera: 'Khyber Pakhtunkhwa', mansehra: 'Khyber Pakhtunkhwa', bannu: 'Khyber Pakhtunkhwa', 'dera ismail khan': 'Khyber Pakhtunkhwa',
  quetta: 'Balochistan', gwadar: 'Balochistan', turbat: 'Balochistan', khuzdar: 'Balochistan', hub: 'Balochistan',
  islamabad: 'Islamabad Capital Territory', gilgit: 'Gilgit-Baltistan', skardu: 'Gilgit-Baltistan', hunza: 'Gilgit-Baltistan',
  muzaffarabad: 'Azad Jammu & Kashmir', mirpur: 'Azad Jammu & Kashmir', kotli: 'Azad Jammu & Kashmir',
};
const STOP = new Set('hai hain ka ki ke ko se me mein main mujhe kya kia kitna kitni kitne price qeemat rate rs please plz chahiye chaiye batao bataen bata do the a an is are what how much for of and or ap aap koi kuch kaun sa sb sab hy h'.split(' '));

async function runBuiltin(mode: string, history: Hist, ctx: Ctx) {
  const q = history[history.length - 1].content;
  const t = q.toLowerCase();
  const s = ctx.store || {};
  const contact = [s.whatsapp && `WhatsApp: ${s.whatsapp}`, s.phone && `Phone: ${s.phone}`].filter(Boolean).join(' | ');
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const city = Object.keys(CITY_PROVINCE).sort((a, b) => b.length - a.length).find((c) => t.includes(c));

  if (mode === 'admin') {
    if (has('sale', 'sales', 'aaj', 'today', 'hafta', 'week', 'mahina', 'month', 'summary')) {
      const days = has('month', 'mahina', 'mahine') ? 30 : has('week', 'hafta', 'hafte') ? 7 : 1;
      const r: any = await callTool(ctx, 'sales_summary', { days });
      return { reply: `Last ${days} day(s): ${r.orders} orders, sales ${r.sales_total}, cancelled ${r.cancelled}, online payments to check: ${r.unpaid_online}.\nBy city: ${Object.entries(r.by_city || {}).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}` };
    }
    if (has('stock', 'khatam', 'kam')) {
      const r: any = await callTool(ctx, 'low_stock', { max_stock: 5 });
      return { reply: r.length ? 'Low stock:\n' + r.slice(0, 20).map((x: any) => `- ${x.product}${x.size ? ` (${x.size})` : ''}: ${x.stock}`).join('\n') : 'All products have enough stock.' };
    }
    if (has('payment', 'paid', 'unpaid', 'verify', 'check')) {
      const r: any = await callTool(ctx, 'list_orders', { unpaid_online_only: true, limit: 15 });
      return { reply: r.length ? 'Online payments to check:\n' + r.map((o: any) => `- ${o.invoice_no} ${o.customer_name} ${money(o.total_amount)} (${o.payment_method})`).join('\n') : 'No online payment is waiting.' };
    }
    if (has('pending', 'order')) {
      const r: any = await callTool(ctx, 'list_orders', { status: has('pending') ? 'Pending' : undefined, limit: 15 });
      return { reply: r.length ? r.map((o: any) => `- ${o.invoice_no} ${o.customer_name}, ${o.city || '-'}, ${money(o.total_amount)}, ${o.status}`).join('\n') : 'No orders found.' };
    }
    return { reply: 'Free assistant: ask about "aaj ki sale", "is hafte ki sale", "pending orders", "kam stock" or "payments to check". To let the assistant also change orders, stock and prices, add a free GEMINI_API_KEY (see README).' };
  }

  // order tracking: order number + 4 digits
  const orderNo = (q.match(/\b[A-Za-z]{2,6}-\d{6}-\d+\b/) || q.match(/\b[A-Za-z]{2,6}-\d{3,7}\b/) || [])[0];
  if (orderNo || has('track', 'order kahan', 'mera order', 'order status', 'parcel')) {
    const last4 = (q.replace(orderNo || '', '').match(/\d{4}(?!\d)/g) || []).pop();
    if (!orderNo || !last4) return { reply: 'Order track karne ke liye apna order number (jaise SK-261022-1005) aur order wale mobile number ke aakhri 4 hindse likhiye.' };
    const r: any = await callTool(ctx, 'track_order', { order_number: orderNo, phone_last4: last4 });
    if (r.error) return { reply: 'Is number aur mobile se koi order nahi mila. Dono dobara check kar lein.' };
    return { reply: `Order ${r.order_number}: ${r.status}\nPayment: ${r.payment}\nTotal: ${r.total}\n${r.items.join(', ')}` +
      (r.courier ? `\nCourier: ${r.courier}${r.tracking_no ? ` - ${r.tracking_no}` : ''}` : '') +
      (r.courier_tracking_link ? `\nTrack with courier: ${r.courier_tracking_link}` : '') +
      `\nInvoice: ${r.invoice_link}` };
  }

  if (city || has('delivery', 'charges', 'shipping', 'cod', 'cash on delivery', 'payment', 'easypaisa', 'jazzcash')) {
    if (!city) return { reply: `Karachi mein Cash on Delivery hai; baqi shehron ke liye online payment (EasyPaisa / JazzCash / bank). Apna shehar likhiye, main delivery charge bata deta hoon.` };
    const r: any = await callTool(ctx, 'delivery_info', { city: city.replace(/\b\w/g, (m) => m.toUpperCase()), province: CITY_PROVINCE[city] });
    return { reply: `${r.city}: delivery ${r.delivery_charge}. Cash on Delivery: ${r.cash_on_delivery}.${r.free_delivery_from && !String(r.free_delivery_from).startsWith('no') ? ` Free delivery from ${r.free_delivery_from}.` : ''}` };
  }

  if (has('contact', 'number', 'whatsapp', 'call', 'complain', 'shikayat', 'return', 'refund')) {
    return { reply: `Hum se rabta: ${contact || 'website par WhatsApp button'}.` };
  }

  if (has('category', 'categories', 'kya kya', 'products hain', 'items')) {
    const r: any = await callTool(ctx, 'list_categories', {});
    return { reply: 'Hamari categories:\n' + r.map((c: any) => `- ${c.name} (${c.products})`).join('\n') };
  }

  const words = t.replace(/[^a-z0-9؀-ۿ ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length) {
    const r: any = await callTool(ctx, 'search_products', { query: words.join(' ') });
    if (r.length) {
      return { reply: r.slice(0, 5).map((p: any) => `• ${p.name} - ${p.price}${p.old_price ? ` (was ${p.old_price})` : ''}${p.sizes ? `\n  Sizes: ${p.sizes.join(', ')}` : ''}${p.in_stock ? '' : ' (sold out)'}\n  ${p.link}`).join('\n') };
    }
  }
  if (has('salam', 'hello', 'hi', 'aoa', 'hey')) return { reply: 'Wa Alaikum Assalam! Product ka naam, apna shehar (delivery ke liye) ya order number likhiye.' };
  return { reply: `Mujhe samajh nahi aaya. Product ka naam likhiye (jaise "shampoo"), delivery ke liye apna shehar, ya order number + mobile ke aakhri 4 hindse. Ya hum se rabta karein: ${contact || 'WhatsApp button'}.` };
}

// ======================= request handler =======================
Deno.serve(async (req) => {
  // Answer the browser's permission check; allow whatever headers the website asks for
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...cors, 'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers'] },
    });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'admin' ? 'admin' : 'customer';
    const site = String(body.site_url || '').replace(/\/$/, '');
    const history: Hist = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'No question.' });
    while (history.length && history[0].role !== 'user') history.shift(); // providers want the user first

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (mode === 'admin') {
      const token = req.headers.get('x-admin-token') || '';
      const { data: ok } = token
        ? await sb.from('admin_sessions').select('profile_id').eq('token', token).gt('expires_at', new Date().toISOString()).limit(1)
        : { data: null };
      if (!ok || !ok.length) return json({ error: 'Admin login required.' });
    }

    const { data: store } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    const s = store || {};
    const ctx: Ctx = { sb, site, store: s };
    const shopName = s.store_name || 'our shop';
    const contact = [s.phone && `phone ${s.phone}`, s.whatsapp && `WhatsApp ${s.whatsapp}`, s.email && `email ${s.email}`].filter(Boolean).join(', ');

    const system = mode === 'customer'
      ? `You are the friendly shopping assistant of ${shopName}, an online shop in Pakistan (hair, beauty and salon products).
Help customers find products, compare sizes and prices, explain delivery charges and payment options, and track orders.
Rules:
- Reply in the customer's language and script (Urdu, Roman Urdu or English). Keep answers short and clear; use Rs. for prices.
- Use the tools for every product, price, stock, delivery or order question. Never invent products, prices or stock.
- When you mention a product, give its link so the customer can open it and press Add to Cart / Buy Now.
- To track an order, ask for the order number and the last 4 digits of the mobile number.
- You cannot place, change or cancel orders, give discounts or take payments. For that, or for complaints, give the shop contact: ${contact || 'the WhatsApp button on the website'}.
- No medical claims; for allergies suggest a patch test.`
      : `You are the admin assistant of ${shopName}'s online shop. The person chatting is the logged-in shop owner/admin.
Help manage the shop: sales summaries, orders, payments, stock and prices. Today is ${new Date().toISOString().slice(0, 10)}.
Rules:
- Reply in the admin's language (Urdu, Roman Urdu or English). Be brief; use short lists for data. Use Rs. for money.
- Use the tools to read data; never guess numbers.
- Change something (status, paid, stock, price) only when the admin clearly asks for that exact change. If the request is unclear (which order, which size, what amount), ask first.
- After a change, say exactly what was changed.
- You cannot delete orders, change passwords or edit settings - tell the admin where to do it in the admin panel.`;

    const tools = mode === 'admin' ? ADMIN_TOOLS : CUSTOMER_TOOLS;
    const pick = (Deno.env.get('AI_PROVIDER') || '').toLowerCase();
    const gemini = Deno.env.get('GEMINI_API_KEY');
    const groq = Deno.env.get('GROQ_API_KEY');
    const claude = Deno.env.get('ANTHROPIC_API_KEY');

    let out: any;
    if ((pick === 'gemini' || !pick) && gemini) out = await runGemini(gemini, system, tools, history, ctx);
    else if ((pick === 'groq' || !pick) && groq) out = await runGroq(groq, system, tools, history, ctx);
    else if ((pick === 'claude' || !pick) && claude) out = await runClaude(claude, system, tools, history, ctx);
    else out = await runBuiltin(mode, history, ctx);

    // if the AI service fails (for example the free daily limit), answer with the free built-in bot instead
    if (out && out.error && pick !== 'builtin' && mode === 'customer') {
      const fb = await runBuiltin(mode, history, ctx);
      return json({ reply: fb.reply, note: out.error });
    }
    return json(out);
  } catch (e) {
    return json({ error: String(e) });
  }
});
