// Vercel function: /sitemap.xml for Google (every product gets its own link).
// Always up to date: new products appear here automatically.
export const config = { runtime: 'edge' };

const SITE = 'https://www.sktraderpk.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export default async function handler() {
  let products = [];
  let posts = [];
  try {
    const h = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
    let r = await fetch(`${SUPABASE_URL}/rest/v1/site_posts?select=kind,slug,cover_url,body,title,updated_at,translations&published=eq.true&order=sort_order.asc`, { headers: h });
    if (!r.ok) r = await fetch(`${SUPABASE_URL}/rest/v1/site_posts?select=kind,slug,cover_url,body,title,updated_at&published=eq.true&order=sort_order.asc`, { headers: h });
    if (r.ok) posts = await r.json();
  } catch { /* no pages yet */ }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,image_url,created_at&order=created_at.desc&limit=5000`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (r.ok) products = await r.json();
  } catch { /* home page only */ }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${SITE}/blog</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...posts.map((p) => {
      const path = p.kind === 'blog' ? `/blog/${p.slug}` : `/${p.slug}`;
      const pic = p.cover_url || ((/<img[^>]+src=["']([^"']+)["']/i.exec(p.body || '') || [])[1] || '');
      const img = /^https?:\/\//.test(pic)
        ? `<image:image><image:loc>${esc(pic)}</image:loc><image:title>${esc(p.title)}</image:title></image:image>` : '';
      const mod = p.updated_at ? `<lastmod>${String(p.updated_at).slice(0, 10)}</lastmod>` : '';
      const tr = p.translations && typeof p.translations === 'object' ? p.translations : {};
      const extra = ['roman', 'en', 'ur', 'hi'].filter((k) => k !== tr._orig && tr[k] && tr[k].body)
        .map((k) => `\n  <url><loc>${SITE}${esc(path)}?lang=${k}</loc>${mod}<changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('');
      return `  <url><loc>${SITE}${esc(path)}</loc>${mod}<changefreq>${p.kind === 'blog' ? 'monthly' : 'yearly'}</changefreq><priority>${p.kind === 'blog' ? '0.7' : '0.4'}</priority>${img}</url>${extra}`;
    }),
    ...products.map((p) => {
      const img = p.image_url && /^https?:\/\//.test(p.image_url)
        ? `<image:image><image:loc>${esc(p.image_url)}</image:loc><image:title>${esc(p.name)}</image:title></image:image>` : '';
      const mod = p.created_at ? `<lastmod>${String(p.created_at).slice(0, 10)}</lastmod>` : '';
      return `  <url><loc>${SITE}/?product=${esc(p.id)}</loc>${mod}<changefreq>weekly</changefreq><priority>0.8</priority>${img}</url>`;
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
}
