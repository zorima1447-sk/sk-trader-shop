// Vercel function: saves one visitor event (Admin > Visitors Report).
// Vercel tells us the visitor's city from their network; we add it and pass the
// event to Supabase. No IP address is saved anywhere.
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|curl|wget|python|axios/i;

const dec = (v) => { try { return v ? decodeURIComponent(v) : ''; } catch { return v || ''; } };

export default async function handler(req) {
  const ok = new Response(null, { status: 204 });
  if (req.method !== 'POST') return ok;
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOTS.test(ua)) return ok;

  let body;
  try { body = await req.json(); } catch { return ok; }
  if (!body || typeof body !== 'object') return ok;

  const p = {
    event: String(body.event || ''),
    visitor_id: String(body.visitor_id || '').slice(0, 40),
    session_id: String(body.session_id || '').slice(0, 40),
    path: String(body.path || '').slice(0, 300),
    product_id: body.product_id ? String(body.product_id) : '',
    query: body.query ? String(body.query).slice(0, 100) : '',
    referrer: String(body.referrer || '').slice(0, 300),
    source: String(body.source || '').slice(0, 20),
    device: String(body.device || '').slice(0, 10),
    city: dec(req.headers.get('x-vercel-ip-city')),
    region: dec(req.headers.get('x-vercel-ip-country-region')),
    country: dec(req.headers.get('x-vercel-ip-country')),
  };

  const token = typeof body.token === 'string' && body.token.split('.').length === 3 ? body.token : '';
  const send = (bearer) => fetch(`${SUPABASE_URL}/rest/v1/rpc/track_event`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p }),
  });
  try {
    let r = await send(token || ANON_KEY);
    if (token && (r.status === 401 || r.status === 403)) r = await send(ANON_KEY); // expired login: save as a guest
  } catch { /* never break the shop for a report */ }
  return ok;
}
