// Vercel function: always returns the CURRENT shop logo (Admin > Store Profile > Logo).
// Used for the link preview (WhatsApp / Facebook) and the browser tab icon, so a new logo
// shows everywhere without changing any code.
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';
const FALLBACK = 'https://ikvffqlkjtptnqnvttjj.supabase.co/storage/v1/object/public/site-assets/logo-1792676146563.png';

export default async function handler() {
  let logo = FALLBACK;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/store_settings?select=logo_url&id=eq.1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (r.ok) {
      const rows = await r.json();
      const u = rows && rows[0] && rows[0].logo_url;
      if (u && /^https?:\/\//.test(u)) logo = u;
    }
  } catch { /* use the fallback */ }

  try {
    const img = await fetch(logo);
    if (!img.ok) throw new Error('logo not found');
    return new Response(img.body, {
      headers: {
        'Content-Type': img.headers.get('content-type') || 'image/png',
        // browsers / WhatsApp may keep it 1 hour; Vercel's edge cache 10 minutes
        'Cache-Control': 'public, max-age=3600, s-maxage=600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.redirect(FALLBACK, 302);
  }
}
