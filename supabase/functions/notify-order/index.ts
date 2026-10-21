// Supabase Edge Function: notify-order
//
// When a customer confirms an order it:
//   1. Emails + WhatsApps the OWNER the order details (customer details and amount).
//   2. Emails the CUSTOMER an invoice (and optionally sends an SMS / WhatsApp via Twilio).
//
// Secrets (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY        free API key from resend.com (emails)
//   CALLMEBOT_APIKEY      key from callmebot.com (WhatsApp alerts to the owner's own number)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM   (optional, customer SMS / WhatsApp)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

// Always answer with HTTP 200 so the website can read the message.
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

async function sendEmail(to: string, subject: string, html: string, text: string, fromName: string, fromAddr: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return 'RESEND_API_KEY secret is not set';
  const from = fromAddr && fromAddr.trim() ? fromAddr.trim() : `${fromName} <onboarding@resend.dev>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  return r.ok ? 'sent' : `failed: ${await r.text()}`;
}

async function sendTwilio(mode: string, toPhone: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromRaw = mode === 'whatsapp' ? Deno.env.get('TWILIO_WHATSAPP_FROM') : Deno.env.get('TWILIO_SMS_FROM');
  if (!sid || !token || !fromRaw) return 'Twilio secrets are not set';
  const strip = (v: string) => v.replace(/^whatsapp:/, '');
  const to = '+' + String(toPhone).replace(/\D/g, '');
  const form = new URLSearchParams({
    To: mode === 'whatsapp' ? `whatsapp:${to}` : to,
    From: mode === 'whatsapp' ? `whatsapp:${strip(fromRaw)}` : strip(fromRaw),
    Body: body,
  });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return r.ok ? 'sent' : `failed: ${await r.text()}`;
}

function invoiceHtml(order: any, items: any[], store: any, accounts: any[], link: string) {
  const total = Number(order.total_amount || 0);
  const paid = Number(order.paid_amount || 0);
  const status = total > 0 && paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY PAID' : 'UNPAID';
  const chosen: string[] = Array.isArray(store.invoice_account_ids) ? store.invoice_account_ids : [];
  const accs = store.invoice_show_accounts === false ? [] : accounts.filter((a) => chosen.includes(a.id));
  const logo = store.invoice_show_logo !== false && store.logo_url && String(store.logo_url).startsWith('http')
    ? `<img src="${esc(store.logo_url)}" alt="" width="60" style="display:block;margin-bottom:8px">` : '';
  const rows = items.map((it, i) =>
    `<tr><td style="padding:6px;border-bottom:1px solid #eee">${i + 1}</td><td style="padding:6px;border-bottom:1px solid #eee">${esc(it.product_name)}</td>` +
    `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${esc(it.quantity)}</td>` +
    `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">PKR ${esc(it.unit_price)}</td>` +
    `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">PKR ${Number(it.unit_price) * Number(it.quantity)}</td></tr>`).join('');
  const accHtml = accs.length
    ? `<p style="margin:16px 0 4px;font-weight:bold">Pay to our accounts</p>` +
      accs.map((a) => `<p style="margin:2px 0">${esc(a.type)} - ${esc(a.account_title)} - ${esc(a.account_number)}</p>`).join('')
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#111;font-size:14px">
    <table width="100%"><tr><td>${logo}<div style="font-size:20px;font-weight:bold">${esc(store.store_name)}</div>
      <div style="color:#555;font-size:12px;white-space:pre-line">${esc(store.address || '')}</div>
      <div style="color:#555;font-size:12px">${esc(store.phone || '')} ${esc(store.email || '')}</div></td>
      <td style="text-align:right;vertical-align:top"><div style="font-size:22px;font-weight:bold">INVOICE</div>
      <div>No: <b>${esc(order.invoice_no || '')}</b></div><div>Date: ${new Date(order.created_at).toUTCString()}</div>
      <div style="margin-top:6px;font-weight:bold">${status}</div></td></tr></table>
    <hr style="border:1px solid #111">
    <p style="margin:12px 0 2px;font-weight:bold">Bill to</p>
    <p style="margin:0">${esc(order.customer_name)}<br>${esc(order.customer_phone || '')}<br>${esc(order.customer_email || '')}<br>${esc(order.shipping_address || '')}</p>
    <table width="100%" style="border-collapse:collapse;margin-top:16px"><thead><tr style="background:#111;color:#fff">
      <th style="padding:6px;text-align:left">#</th><th style="padding:6px;text-align:left">Item</th><th style="padding:6px;text-align:right">Qty</th>
      <th style="padding:6px;text-align:right">Unit</th><th style="padding:6px;text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="text-align:right;margin:10px 0 0">Total: <b>PKR ${total}</b><br>Paid: PKR ${paid}<br><b>Balance due: PKR ${Math.max(total - paid, 0)}</b></p>
    <p>Payment method: ${esc(String(order.payment_method || '').toUpperCase())}</p>
    ${accHtml}
    <p style="margin-top:16px"><a href="${esc(link)}">View / print this invoice online</a></p>
    <p style="color:#666;white-space:pre-line">${esc(store.invoice_footer_note || '')}</p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { order_id, test, resend_invoice, site_url } = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: s } = await sb.from('notification_settings').select('*').eq('id', 1).maybeSingle();
    const { data: storeRow } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    const store = storeRow || { store_name: 'Online Store' };
    const storeName = store.store_name || 'Online Store';
    const fromAddr = store.email_from || '';

    // ---- owner alerts (shared by the test and by real orders) ----
    const ownerAlert = async (subject: string, text: string) => {
      const result: Record<string, string> = {};
      if (s && s.email_enabled && s.email_to) {
        result.email = await sendEmail(s.email_to, subject, `<pre style="font-family:Arial">${esc(text)}</pre>`, text, storeName, fromAddr);
      } else result.email = 'off';
      if (s && s.whatsapp_enabled && s.whatsapp_phone) {
        const key = Deno.env.get('CALLMEBOT_APIKEY');
        if (!key) result.whatsapp = 'CALLMEBOT_APIKEY secret is not set';
        else {
          const phone = '+' + String(s.whatsapp_phone).replace(/\D/g, '');
          const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`);
          result.whatsapp = r.ok ? 'sent' : `failed: ${await r.text()}`;
        }
      } else result.whatsapp = 'off';
      return result;
    };

    // ---- admin test ----
    if (test) {
      if (!(await isAdmin(sb, req))) return json({ error: 'Admin login required.' });
      if (!s) return json({ error: 'notification_settings row not found. Run supabase_setup.sql.' });
      return json(await ownerAlert('Test alert - ' + storeName, 'Test alert: email / WhatsApp alerts are working.'));
    }

    if (!order_id) return json({ error: 'order_id required' });
    if (resend_invoice && !(await isAdmin(sb, req))) return json({ error: 'Admin login required.' });

    const { data: order } = await sb.from('orders').select('*').eq('id', order_id).maybeSingle();
    if (!order) return json({ error: 'Order not found' });
    const { data: items } = await sb.from('order_items').select('*').eq('order_id', order_id);
    const { data: accounts } = await sb.from('payment_accounts').select('*');
    const lines = (items || []).map((i: any) => `${i.quantity} x ${i.product_name} (PKR ${i.unit_price})`).join('\n');
    const out: Record<string, unknown> = {};

    // ---- 1. owner alert (once per order) ----
    if (!resend_invoice && !order.notified) {
      const text =
        `NEW ORDER ${order.invoice_no || ''}\n` +
        `Customer: ${order.customer_name}\n` +
        `Phone: ${order.customer_phone}\n` +
        `Email: ${order.customer_email || '-'}\n` +
        `Address: ${order.shipping_address}\n` +
        `Payment: ${order.payment_method}\n` +
        (order.transaction_id ? `Txn ID: ${order.transaction_id}\n` : '') +
        `Items:\n${lines}\n` +
        `Total: PKR ${order.total_amount}`;
      out.owner = await ownerAlert(`New Order ${order.invoice_no || ''} - PKR ${order.total_amount}`, text);
      await sb.from('orders').update({ notified: true }).eq('id', order_id);
    }

    // ---- 2. customer invoice (once per order, or again when the admin asks) ----
    if (resend_invoice || !order.invoice_sent) {
      const link = `${site_url || ''}/?invoice=${order.id}`;
      let invoiceEmail = 'off';
      if (store.email_invoice_enabled !== false && order.customer_email) {
        const html = invoiceHtml(order, items || [], store, accounts || [], link);
        invoiceEmail = await sendEmail(order.customer_email, `Your invoice ${order.invoice_no || ''} from ${storeName}`, html,
          `Invoice ${order.invoice_no}\nTotal: PKR ${order.total_amount}\n${lines}\nView online: ${link}`, storeName, fromAddr);
      }
      out.invoice_email = invoiceEmail;

      const mode = store.customer_msg_mode || 'off';
      if (mode !== 'off' && order.customer_phone) {
        out.invoice_mobile = await sendTwilio(mode, order.customer_phone,
          `${storeName}: thank you ${order.customer_name}! Invoice ${order.invoice_no || ''}, total PKR ${order.total_amount}. View: ${link}`);
      } else out.invoice_mobile = 'off';

      if (invoiceEmail === 'sent' || out.invoice_mobile === 'sent') {
        await sb.from('orders').update({ invoice_sent: true }).eq('id', order_id);
      }
    } else {
      out.invoice_email = 'already sent';
    }

    return json(out);
  } catch (e) {
    return json({ error: String(e) });
  }
});
