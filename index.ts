// Supabase Edge Function: notify-order
// Sends the owner an Email (Resend) and a WhatsApp (CallMeBot) alert when a new order arrives.
// Secrets (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY    -> free API key from resend.com
//   CALLMEBOT_APIKEY  -> key received from callmebot.com after WhatsApp activation
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { order_id, test } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: s } = await supabase.from('notification_settings').select('*').eq('id', 1).maybeSingle();
    if (!s) return json({ error: 'notification_settings row not found. Run supabase_setup.sql.' }, 400);

    let text: string;
    let subject: string;

    if (test) {
      subject = 'Test alert - SK Trader Shop';
      text = 'Test alert: email / WhatsApp alerts are working.';
    } else {
      if (!order_id) return json({ error: 'order_id required' }, 400);

      const { data: order } = await supabase.from('orders').select('*').eq('id', order_id).maybeSingle();
      if (!order) return json({ error: 'order not found' }, 404);
      if (order.notified) return json({ skipped: 'already notified' });

      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order_id);
      const lines = (items || []).map((i: any) => `${i.quantity} x ${i.product_name} (PKR ${i.unit_price})`).join('\n');

      subject = `New Order ${order.invoice_no || ''} - PKR ${order.total_amount}`;
      text =
        `NEW ORDER ${order.invoice_no || ''}\n` +
        `Customer: ${order.customer_name}\n` +
        `Phone: ${order.customer_phone}\n` +
        `Address: ${order.shipping_address}\n` +
        `Payment: ${order.payment_method} (${order.payment_status})\n` +
        (order.transaction_id ? `Txn ID: ${order.transaction_id}\n` : '') +
        `Items:\n${lines}\n` +
        `Total: PKR ${order.total_amount}`;

      await supabase.from('orders').update({ notified: true }).eq('id', order_id);
    }

    const result: Record<string, string> = {};

    // ---- EMAIL (Resend) ----
    if (s.email_enabled && s.email_to) {
      const key = Deno.env.get('RESEND_API_KEY');
      if (!key) {
        result.email = 'RESEND_API_KEY secret is not set';
      } else {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'SK Trader Shop <onboarding@resend.dev>',
            to: [s.email_to],
            subject,
            text,
          }),
        });
        result.email = r.ok ? 'sent' : `failed: ${await r.text()}`;
      }
    } else {
      result.email = 'off';
    }

    // ---- WHATSAPP (CallMeBot) ----
    if (s.whatsapp_enabled && s.whatsapp_phone) {
      const key = Deno.env.get('CALLMEBOT_APIKEY');
      if (!key) {
        result.whatsapp = 'CALLMEBOT_APIKEY secret is not set';
      } else {
        const phone = '+' + String(s.whatsapp_phone).replace(/\D/g, '');
        const url =
          `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
          `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`;
        const r = await fetch(url);
        result.whatsapp = r.ok ? 'sent' : `failed: ${await r.text()}`;
      }
    } else {
      result.whatsapp = 'off';
    }

    return json(result);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
