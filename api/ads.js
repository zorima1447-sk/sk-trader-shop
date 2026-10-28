// Vercel function: /ads.txt for Google AdSense, made from the publisher ID saved in
// Admin > Blog & Pages (no file to upload by hand).
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';

export default async function handler() {
  let body = '# SK Trader - no ad network set up yet\n';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/store_settings?select=adsense_client&id=eq.1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (r.ok) {
      const rows = await r.json();
      const id = rows && rows[0] && rows[0].adsense_client;
      if (id && /^ca-pub-\d{10,20}$/.test(id)) body = `google.com, ${id.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
    }
  } catch { /* keep the empty file */ }
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' } });
}
