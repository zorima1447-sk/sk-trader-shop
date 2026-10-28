// Vercel Routing Middleware: when a PRODUCT link (www.sktraderpk.com/?product=...) is opened,
// put that product's name, price and picture into the page's preview tags. Then WhatsApp /
// Facebook show the product photo, and Google sees the product name and price.
// Info pages (/about ...) and blog articles (/blog/...) are also written into the page itself,
// so Google (and AdSense) can read them. The AdSense code is added when its ID is saved.
// Any problem -> the normal page is shown, nothing breaks.
export const config = { matcher: ['/', '/blog', '/blog/:slug*', '/:slug'] };

const SITE = 'https://www.sktraderpk.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
// public (anon) key - the same one the website itself uses; safe to be public
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrdmZmcWxranRwdG5xbnZ0dGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQwNDQsImV4cCI6MjEwNzg0MDA0NH0.4MrqKcxuso4hX1bTstjtbWD5jzSGHX9ii0_nGeZTc08';

const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
const RESERVED = new Set(['index.html', 'api', 'assets']);

// AdSense ID and where ads may appear, kept for 5 minutes
let adsCache = { id: '', place: 'blog', at: 0 };
async function adsenseInfo() {
  if (Date.now() - adsCache.at < 300000) return adsCache;
  let id = '', place = 'blog';
  try {
    let r = await fetch(`${SUPABASE_URL}/rest/v1/store_settings?select=adsense_client,ads_place&id=eq.1`, { headers: H });
    if (!r.ok) r = await fetch(`${SUPABASE_URL}/rest/v1/store_settings?select=adsense_client&id=eq.1`, { headers: H });
    if (r.ok) { const j = await r.json(); id = (j && j[0] && j[0].adsense_client) || ''; place = (j && j[0] && j[0].ads_place) === 'all' ? 'all' : 'blog'; }
  } catch { /* none */ }
  const m = String(id).trim().toLowerCase().match(/^(?:ca-)?pub-(\d{10,20})$/);
  adsCache = { id: m ? `ca-pub-${m[1]}` : '', place, at: Date.now() };
  return adsCache;
}

function setTags(html, t) {
  const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`); };
  set(/<title>[^<]*<\/title>/, `<title>${esc(t.title)}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(t.desc)}" />`);
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(t.link)}" />`);
  set(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${t.type}" />`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(t.title)}" />`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(t.desc)}" />`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(t.link)}" />`);
  set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(t.img)}" />`);
  set(/<meta property="og:image:secure_url"[^>]*>/, `<meta property="og:image:secure_url" content="${esc(t.img)}" />`);
  set(/<meta property="og:image:type"[^>]*>/, '');
  set(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(t.title)}" />`);
  set(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="${t.big ? 'summary_large_image' : 'summary'}" />`);
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(t.title)}" />`);
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(t.desc)}" />`);
  set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(t.img)}" />`);
  return html;
}

const addLd = (html, ld) => html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
// full = load the ad code; otherwise only the account tag (AdSense site verification) is added
const addAds = (html, ads, full = true) => {
  if (!ads || !ads.id || html.includes('google-adsense-account')) return html;
  const tag = `<meta name="google-adsense-account" content="${ads.id}" />`;
  const code = full ? `\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.id}" crossorigin="anonymous"></script>` : '';
  return html.replace('</head>', `${tag}${code}\n</head>`);
};
const LANG_HTML = { roman: 'ur-Latn', en: 'en', ur: 'ur', hi: 'hi' };
// readable content for Google inside the page (React replaces it when the shop starts)
const addContent = (html, inner) => html.replace('<div id="root"></div>',
  `<div id="root"><main style="max-width:760px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;line-height:1.7;color:#1e293b">${inner}</main></div>`);
const cleanBody = (b) => String(b || '').replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/\[\[\s*(products\s*:[^\]]*|ad)\s*\]\]/gi, '');
const page = (html) => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' } });

export default async function middleware(req) {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const seg = path.slice(1);
    if (path !== '/' && (seg.includes('.') || RESERVED.has(seg))) return pass();
    const id = url.searchParams.get('product') || '';
    const isProduct = path === '/' && /^[0-9a-f-]{36}$/i.test(id);
    const blogList = path === '/blog';
    const m = path.match(/^\/blog\/([a-z0-9-]+)$/i);
    const slug = m ? m[1].toLowerCase() : (/^[a-z0-9-]+$/i.test(seg) ? seg.toLowerCase() : '');
    if (path !== '/' && !blogList && !slug) return pass();

    const [ads, pageRes] = await Promise.all([
      adsenseInfo(),
      fetch(new URL('/index.html', url), { headers: { 'user-agent': req.headers.get('user-agent') || '' } }),
    ]);
    if (!pageRes.ok) return pass();
    let html = await pageRes.text();
    if (!html.includes('</head>')) return pass();

    // ---- the shop home page ----
    const shopAds = ads.place === 'all'; // ads on shop pages too?
    if (path === '/' && !isProduct) return ads.id ? page(addAds(html, ads, shopAds)) : pass();

    // ---- a product link ----
    if (isProduct) {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,description,image_url,price,discounted_price,stock_quantity,category_name&id=eq.${id}`, { headers: H });
      if (!pr.ok) return ads.id ? page(addAds(html, ads, shopAds)) : pass();
      const rows = await pr.json();
      const p = rows && rows[0];
      if (!p) return ads.id ? page(addAds(html, ads, shopAds)) : pass();
      const price = Number(p.discounted_price || p.price || 0);
      const title = `${p.name}${price ? ` - Rs ${price.toLocaleString('en-PK')}` : ''} | SK TRADER`;
      const desc = (plain(p.description) || `Buy ${p.name} online at SK TRADER Karachi. Original product, delivery across Pakistan, Cash on Delivery.`).slice(0, 180);
      const img = p.image_url && /^https?:\/\//.test(p.image_url) ? p.image_url : `${SITE}/api/logo`;
      const link = `${SITE}/?product=${p.id}`;
      html = setTags(html, { title, desc, link, img, type: 'product', big: true });
      html = html.replace('</head>', `<meta property="product:price:amount" content="${price}" />\n<meta property="product:price:currency" content="PKR" />\n</head>`);
      html = addLd(html, {
        '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: [img], description: desc,
        category: p.category_name || undefined, url: link,
        brand: { '@type': 'Brand', name: String(p.name).split(' ')[0] },
        offers: {
          '@type': 'Offer', url: link, priceCurrency: 'PKR', price: price || undefined,
          availability: Number(p.stock_quantity) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'SK TRADER' },
        },
      });
      return page(addAds(html, ads, shopAds));
    }

    // ---- the blog list ----
    if (blogList) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_posts?select=slug,title,description,cover_url&kind=eq.blog&published=eq.true&order=sort_order.asc,created_at.desc`, { headers: H });
      const list = r.ok ? await r.json() : [];
      html = setTags(html, { title: 'Hair & Beauty Tips - Blog | SK TRADER', desc: 'Hair care, skin care and beauty tips from SK Trader Karachi: hair fall, dandruff, hair colour, masks and more.', link: `${SITE}/blog`, img: `${SITE}/api/logo`, type: 'website' });
      html = addContent(html, `<h1>Hair &amp; Beauty Tips</h1>${(list || []).map((p) => `<article><h2><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2><p>${esc(p.description || '')}</p></article>`).join('')}`);
      return page(addAds(html, ads, true));
    }

    // ---- an info page or a blog article ----
    const kind = m ? 'blog' : 'page';
    const q = `slug=eq.${encodeURIComponent(slug)}&kind=eq.${kind}&published=eq.true`;
    let r = await fetch(`${SUPABASE_URL}/rest/v1/site_posts?select=kind,slug,title,description,cover_url,body,created_at,updated_at,translations&${q}`, { headers: H });
    if (!r.ok) r = await fetch(`${SUPABASE_URL}/rest/v1/site_posts?select=kind,slug,title,description,cover_url,body,created_at,updated_at&${q}`, { headers: H });
    const rows = r.ok ? await r.json() : [];
    const p0 = rows && rows[0];
    if (!p0) return ads.id ? page(addAds(html, ads, true)) : pass();
    // language versions (?lang=en / ur / hi)
    const tr = (p0.translations && typeof p0.translations === 'object') ? p0.translations : {};
    const orig = tr._orig || (kind === 'blog' ? 'roman' : 'en');
    const langs = [orig, ...['roman', 'en', 'ur', 'hi'].filter((k) => k !== orig && tr[k] && tr[k].body)];
    const want = url.searchParams.get('lang') || '';
    const lang = langs.includes(want) ? want : orig;
    const t = lang !== orig ? tr[lang] : null;
    const p = t ? { ...p0, title: t.title || p0.title, description: t.description || p0.description, body: t.body } : p0;
    const base = `${SITE}${kind === 'blog' ? '/blog/' : '/'}${p.slug}`;
    const link = lang === orig ? base : `${base}?lang=${lang}`;
    if (langs.length > 1) {
      html = html.replace('</head>', langs.map((k) => `<link rel="alternate" hreflang="${LANG_HTML[k] || k}" href="${k === orig ? base : `${base}?lang=${k}`}" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${base}" />\n</head>`);
    }
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${LANG_HTML[lang] || 'en'}"${lang === 'ur' ? ' dir="rtl"' : ''}`);
    const desc = (p.description || plain(p.body)).slice(0, 180);
    const img = p.cover_url && /^https?:\/\//.test(p.cover_url) ? p.cover_url : `${SITE}/api/logo`;
    html = setTags(html, { title: `${p.title} | SK TRADER`, desc, link, img, type: kind === 'blog' ? 'article' : 'website', big: !!p.cover_url });
    if (kind === 'blog') {
      html = addLd(html, {
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: desc, image: [img],
        datePublished: p.created_at, dateModified: p.updated_at || p.created_at, mainEntityOfPage: link, inLanguage: 'ur-PK',
        author: { '@type': 'Organization', name: 'SK TRADER', url: SITE },
        publisher: { '@type': 'Organization', name: 'SK TRADER', logo: { '@type': 'ImageObject', url: `${SITE}/api/logo` } },
      });
      html = addLd(html, {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: p.title, item: link },
        ],
      });
    }
    const cover = p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.title)}" style="max-width:100%;border-radius:12px" />` : '';
    html = addContent(html, `<h1>${esc(p.title)}</h1>${cover}${cleanBody(p.body)}`);
    return page(addAds(html, ads, true));
  } catch {
    return pass();
  }
}
