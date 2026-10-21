// Supabase Edge Function: notify-customers
//
// Emails customers about a NEW PRODUCT or a custom DEAL / announcement.
// Only customers who have an email address and agreed to receive offers are emailed.
// Only a logged-in admin may call it (the login token is checked against the admin_sessions table).
//
// Secrets: RESEND_API_KEY  (free key from resend.com)
// Set the sender address in Admin > Settings > Customer Messages (verify your domain in Resend to email real customers).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const { type, product_id, subject, message, site_url } = body;

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!(await isAdmin(sb, req))) return json({ error: 'Admin login required.' });

    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return json({ error: 'RESEND_API_KEY secret is not set.' });

    const { data: storeRow } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    const store = storeRow || { store_name: 'Online Store' };
    const storeName = store.store_name || 'Online Store';
    const from = store.email_from && String(store.email_from).trim() ? String(store.email_from).trim() : `${storeName} <onboarding@resend.dev>`;
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
        <p style="margin:0 0 8px;color:#444">${esc(String(p.description || '').slice(0, 300))}</p>
        <p style="font-size:18px;margin:8px 0"><b>PKR ${price}</b>${orig > price ? ` <span style="color:#888;text-decoration:line-through">PKR ${orig}</span>` : ''}</p>
        <a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Shop now</a>`;
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
        note = (await r.text()).slice(0, 300);
      }
    }
    return json({ sent, failed, note });
  } catch (e) {
    return json({ error: String(e) });
  }
});
