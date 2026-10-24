// Supabase Edge Function: notify-customers
//
// Emails customers about a NEW PRODUCT or a custom DEAL / announcement.
// Only customers who have an email address and agreed to receive offers are emailed.
// Only a logged-in admin may call it (the login token is checked against the admin_sessions table).
//
// Secrets: RESEND_API_KEY  (free key from resend.com)
// Set the sender address in Admin > Settings > Customer Messages (verify your domain in Resend to email real customers).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Sender address for Resend. A free mailbox (gmail, yahoo...) or a badly typed address can not be
// used as sender, so then Resend's own test sender is used with the shop name.
function senderAddress(storeName: string, emailFrom: string): string {
  const clean = (t: string) => String(t || '').replace(/[<>"(),;:\\@\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const name = clean(storeName) || 'Online Store';
  const raw = String(emailFrom || '').trim();
  const m = raw.match(/^"?([^"<]*?)"?\s*<\s*([^\s<>@]+@([^\s<>@]+\.[a-z]{2,}))\s*>$/i)
    || raw.match(/^()([^\s<>@]+@([^\s<>@]+\.[a-z]{2,}))$/i);
  if (m) {
    const domain = m[3].toLowerCase();
    const free = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail)\./.test(domain);
    if (!free) return `${clean(m[1] || '') || name} <${m[2]}>`;
  }
  return `${name} <onboarding@resend.dev>`;
}

// Short, clear explanation of a Resend error
function resendNote(t: string): string {
  if (/only send testing emails|verify a domain|domain is not verified/i.test(t)) {
    return 'Resend can only send to YOUR OWN email until you verify a domain in Resend (Resend > Domains). Customer emails need a verified domain (for example sktrader.pk).';
  }
  return t.slice(0, 300);
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-region, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The website sends the admin's login token in the "x-admin-token" header (see src/supabaseClient.ts).
async function isAdmin(sb: any, req: Request) {
  const token = req.headers.get('x-admin-token') || '';
  if (!token) return false;
  const { data } = await sb.from('admin_sessions').select('profile_id')
    .eq('token', token).gt('expires_at', new Date().toISOString()).limit(1);
  return !!(data && data.length);
}

Deno.serve(async (req) => {
  // Answer the browser's permission check; allow whatever headers the website asks for
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...cors, 'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers'] },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { type, product_id, deal_id, subject, message, site_url } = body;

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await isAdmin(sb, req))) return json({ error: 'Admin login required.' });

    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return json({ error: 'RESEND_API_KEY secret is not set.' });

    const { data: storeRow } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    const store = storeRow || { store_name: 'Online Store' };
    const storeName = store.store_name || 'Online Store';
    const from = senderAddress(storeName, store.email_from);
    const link = site_url || '';

    let mailSubject = '';
    let inner = '';

    if (type === 'product') {
      const { data: p } = await sb.from('products').select('*').eq('id', product_id).maybeSingle();
      if (!p) return json({ error: 'Product not found.' });
      const price = Number(p.discounted_price || p.price || 0);
      const orig = Number(p.original_price || 0);
      mailSubject = `New at ${storeName}: ${p.name}`;
      const img = p.image_url && String(p.image_url).startsWith('http')
        ? `<img src="${esc(p.image_url)}" alt="" width="320" style="max-width:100%;border-radius:8px;display:block;margin:12px 0">` : '';
      inner = `<h2 style="margin:0 0 8px">${esc(p.name)}</h2>${img}
        <p style="margin:0 0 8px;color:#444">${esc(String(p.description || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300))}</p>
        <p style="font-size:18px;margin:8px 0"><b>PKR ${price}</b>${orig > price ? ` <span style="color:#888;text-decoration:line-through">PKR ${orig}</span>` : ''}</p>
        <a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Shop now</a>`;
    } else if (type === 'deal') {
      const { data: d } = await sb.from('deals').select('*').eq('id', deal_id).maybeSingle();
      if (!d) return json({ error: 'Deal not found.' });
      const items: any[] = Array.isArray(d.items) ? d.items : [];
      const ids = items.map((i) => i.product_id).filter(Boolean);
      const { data: prods } = ids.length
        ? await sb.from('products').select('id,name,price,discounted_price,image_url,variants,variant_label').in('id', ids)
        : { data: [] as any[] };
      const byId = new Map((prods || []).map((p: any) => [p.id, p]));
      let cur = 0;
      const rows = items.map((it) => {
        const p: any = byId.get(it.product_id);
        if (!p) return '';
        const qty = Math.max(1, Number(it.qty) || 1);
        const vs: any[] = Array.isArray(p.variants) ? p.variants : [];
        const v = it.variant ? vs.find((x) => x && x.name === it.variant) : null;
        const unit = v ? Number(v.price) || 0 : Number(p.discounted_price || p.price) || 0;
        cur += unit * qty;
        const extra = it.choose ? ` <span style="color:#b45309">(choose your ${esc(String(p.variant_label || 'option').toLowerCase())})</span>` : (it.variant ? ` - ${esc(it.variant)}` : '');
        return `<li style="margin:2px 0">${qty > 1 ? qty + ' x ' : ''}${esc(p.name)}${extra}</li>`;
      }).join('');
      const price = Number(d.deal_price) || 0;
      const save = cur > price && cur > 0 ? Math.round(((cur - price) / cur) * 100) : 0;
      const firstImg = (byId.get(items[0]?.product_id) as any)?.image_url || '';
      const pic = [d.image_url, firstImg].find((u: any) => u && String(u).startsWith('http')) || '';
      const ends = d.ends_at
        ? new Date(d.ends_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      mailSubject = `New deal at ${storeName}: ${d.name} - only PKR ${price}${save ? ` (save ${save}%)` : ''}`;
      inner = `<p style="display:inline-block;background:#dc2626;color:#fff;font-weight:bold;font-size:12px;padding:3px 10px;border-radius:20px;margin:0 0 8px">SPECIAL DEAL${save ? ` - SAVE ${save}%` : ''}</p>
        <h2 style="margin:0 0 8px">${esc(d.name)}</h2>
        ${pic ? `<img src="${esc(pic)}" alt="" width="360" style="max-width:100%;border-radius:10px;display:block;margin:12px 0">` : ''}
        ${d.description ? `<p style="margin:0 0 8px;color:#444">${esc(d.description)}</p>` : ''}
        <p style="margin:8px 0 4px;font-weight:bold">This deal includes:</p>
        <ul style="margin:0 0 10px;padding-left:18px;color:#333">${rows}</ul>
        <p style="font-size:20px;margin:8px 0"><b>PKR ${price}</b>${cur > price ? ` <span style="color:#888;text-decoration:line-through;font-size:14px">PKR ${cur}</span>` : ''}</p>
        ${ends ? `<p style="margin:0 0 12px;color:#b91c1c;font-weight:bold">Hurry! Deal ends on ${esc(ends)}</p>` : ''}
        <a href="${esc(link)}/#shop-deals" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Get this deal</a>`;
    } else if (type === 'custom') {
      if (!subject || !message) return json({ error: 'Subject and message are required.' });
      mailSubject = String(subject);
      inner = `<div style="white-space:pre-line;color:#222">${esc(message)}</div>
        <p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Visit the store</a></p>`;
    } else {
      return json({ error: 'Unknown type.' });
    }

    const { data: customers } = await sb
      .from('customers')
      .select('name,email,marketing_opt_in')
      .not('email', 'is', null)
      .neq('email', '');
    const seen = new Set<string>();
    const targets = (customers || []).filter((c: any) => {
      if (c.marketing_opt_in === false) return false;
      const e = String(c.email).trim().toLowerCase();
      if (!e || seen.has(e)) return false;
      seen.add(e);
      return true;
    });

    if (targets.length === 0) return json({ sent: 0, failed: 0, note: 'No customers with an email who agreed to receive offers.' });

    const mails = targets.map((c: any) => ({
      from,
      to: [String(c.email).trim()],
      subject: mailSubject,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;font-size:14px">
        <p>Hello ${esc(c.name || '')},</p>${inner}
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:11px">You are receiving this email because you shop at ${esc(storeName)}.
        To stop receiving offers, just reply to this email and tell us.</p></div>`,
    }));

    let sent = 0;
    let failed = 0;
    let note = '';
    for (let i = 0; i < mails.length; i += 100) {
      const chunk = mails.slice(i, i + 100);
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (r.ok) sent += chunk.length;
      else {
        failed += chunk.length;
        note = resendNote(await r.text());
      }
    }
    return json({ sent, failed, note });
  } catch (e) {
    return json({ error: String(e) });
  }
});
