// Supabase Edge Function: ai-chat
//
// The shop's AI assistant (uses Claude from Anthropic).
//   mode "customer": answers shoppers - products, prices, sizes, delivery charges, order tracking.
//   mode "admin":    helps the owner - sales summary, orders, low stock, and simple changes
//                    (order status, mark paid, stock, price). Needs a logged-in admin (x-admin-token).
//
// Secrets (Supabase > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  -> from https://console.anthropic.com (paid per use)
//   AI_MODEL           -> optional, default "claude-haiku-5-5" (fast and low cost)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'The AI assistant is not switched on yet (ANTHROPIC_API_KEY secret is missing).' });
    const model = Deno.env.get('AI_MODEL') || 'claude-haiku-5-5';

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'admin' ? 'admin' : 'customer';
    const site = String(body.site_url || '').replace(/\/$/, '');
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'No question.' });

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
- Reply in the admin's language (Urdu, Roman Urdu or English). Be brief; use tables or short lists for data. Use Rs. for money.
- Use the tools to read data; never guess numbers.
- Change something (status, paid, stock, price) only when the admin clearly asks for that exact change. If the request is unclear (which order, which size, what amount), ask first.
- After a change, say exactly what was changed.
- You cannot delete orders, change passwords or edit settings - tell the admin where to do it in the admin panel.`;

    const tools = mode === 'admin' ? ADMIN_TOOLS : CUSTOMER_TOOLS;
    const messages: any[] = [...history];

    for (let step = 0; step < 6; step++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1024, system, tools, messages }),
      });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: `AI service error (${r.status}). ${r.status === 401 ? 'Check the ANTHROPIC_API_KEY.' : t.slice(0, 200)}` });
      }
      const res = await r.json();
      const content = res.content || [];
      if (res.stop_reason !== 'tool_use') {
        const text = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
        return json({ reply: text || '...' });
      }
      messages.push({ role: 'assistant', content });
      const results = [];
      for (const c of content) {
        if (c.type !== 'tool_use') continue;
        let out: unknown;
        try { out = await runTool(sb, c.name, c.input || {}, { site, store: s }); } catch (e) { out = { error: String(e) }; }
        results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out).slice(0, 12000) });
      }
      messages.push({ role: 'user', content: results });
    }
    return json({ reply: 'Sorry, I could not finish that. Please ask in a simpler way.' });
  } catch (e) {
    return json({ error: String(e) });
  }
});
