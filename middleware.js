// Vercel Routing Middleware: when a PRODUCT link (www.sktraderpk.com/?product=...) is opened,
// put that product's name, price and picture into the page's preview tags. Then WhatsApp /
// Facebook show the product photo, and Google sees the product name and price.
// Any problem -> the normal page is shown, nothing breaks.
export const config = { matcher: '/' };

const SITE = 'https://www.sktraderpk.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';

const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export default async function middleware(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('product') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return pass();

    const [pr, page] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,description,image_url,price,discounted_price,stock_quantity,category_name&id=eq.${id}`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      }),
      fetch(new URL('/index.html', url), { headers: { 'user-agent': req.headers.get('user-agent') || '' } }),
    ]);
    if (!pr.ok || !page.ok) return pass();
    const rows = await pr.json();
    const p = rows && rows[0];
    if (!p) return pass();
    let html = await page.text();
    if (!html.includes('</head>')) return pass();

    const price = Number(p.discounted_price || p.price || 0);
    const title = `${p.name}${price ? ` - Rs ${price.toLocaleString('en-PK')}` : ''} | SK TRADER`;
    const desc = (plain(p.description) || `Buy ${p.name} online at SK TRADER Karachi. Original product, delivery across Pakistan, Cash on Delivery.`).slice(0, 180);
    const img = p.image_url && /^https?:\/\//.test(p.image_url) ? p.image_url : `${SITE}/api/logo`;
    const link = `${SITE}/?product=${p.id}`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: [img], description: desc,
      category: p.category_name || undefined, url: link,
      brand: { '@type': 'Brand', name: String(p.name).split(' ')[0] },
      offers: {
        '@type': 'Offer', url: link, priceCurrency: 'PKR', price: price || undefined,
        availability: Number(p.stock_quantity) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: 'SK TRADER' },
      },
    };

    const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`); };
    set(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
    set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
    set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(link)}" />`);
    set(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="product" />`);
    set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
    set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`);
    set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(link)}" />`);
    set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(img)}" />`);
    set(/<meta property="og:image:secure_url"[^>]*>/, `<meta property="og:image:secure_url" content="${esc(img)}" />`);
    set(/<meta property="og:image:type"[^>]*>/, '');
    set(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(p.name)}" />`);
    set(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image" />`);
    set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
    set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`);
    set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(img)}" />`);
    html = html.replace('</head>', `<meta property="product:price:amount" content="${price}" />\n<meta property="product:price:currency" content="PKR" />\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    });
  } catch {
    return pass();
  }
}
