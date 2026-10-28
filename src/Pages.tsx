import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { RichTextEditor, sanitizeHtml, htmlToText } from './RichText';
import { price } from './currency';

// ---------------------------------------------------------------------------
// Info pages (About, Contact, Privacy Policy, Terms) and the Blog.
// Saved in the "site_posts" table. Links: /about, /contact, /privacy-policy,
// /terms-and-conditions, /blog and /blog/<article>.
// In an article, a line like  [[products: shampoo, mask | Heading]]  shows a box
// with matching products from the shop.
// ---------------------------------------------------------------------------

export interface Post {
  id: string;
  kind: 'page' | 'blog';
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  body: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type ShopProduct = { id: string; name: string; price: number; discounted_price?: number; original_price?: number; image_url?: string; category_name?: string; stock_quantity?: number };

export const PAGE_SLUGS = ['about', 'contact', 'privacy-policy', 'terms-and-conditions'];

// Which page the address bar points to: { view: 'page', slug } / { view: 'blog' } / null (the shop)
export function routeFromPath(path: string): { view: 'page' | 'blog'; slug: string } | null {
  const p = (path || '/').replace(/\/+$/, '') || '/';
  if (p === '/blog') return { view: 'blog', slug: '' };
  const m = p.match(/^\/blog\/([a-z0-9-]+)$/i);
  if (m) return { view: 'page', slug: m[1].toLowerCase() };
  const s = p.slice(1).toLowerCase();
  if (/^[a-z0-9-]+$/.test(s) && PAGE_SLUGS.includes(s)) return { view: 'page', slug: s };
  if (/^[a-z0-9-]+$/.test(s) && s && !s.includes('.')) return { view: 'page', slug: s }; // pages added by the admin
  return null;
}

export const postPath = (p: Pick<Post, 'kind' | 'slug'>) => (p.kind === 'blog' ? `/blog/${p.slug}` : `/${p.slug}`);

export const slugify = (t: string) =>
  t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export async function fetchPosts(all = false): Promise<Post[]> {
  let q = supabase.from('site_posts').select('*');
  if (!all) q = q.eq('published', true);
  const { data, error } = await q.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as Post[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const readMinutes = (html: string) => Math.max(1, Math.round(htmlToText(html || '').split(/\s+/).length / 200));

// ---------------- product box inside an article ----------------
function ProductBox({ spec, products, onOpenProduct }: { spec: string; products: ShopProduct[]; onOpenProduct: (p: ShopProduct) => void }) {
  const [words, heading] = spec.split('|').map((x) => x.trim());
  const keys = (words || '').toLowerCase().split(/[,،]+/).map((k) => k.trim()).filter(Boolean);
  const hits = products
    .filter((p) => keys.some((k) => `${p.name} ${p.category_name || ''}`.toLowerCase().includes(k)))
    .sort((a, b) => Number((b.stock_quantity || 0) > 0) - Number((a.stock_quantity || 0) > 0))
    .slice(0, 4);
  if (!hits.length) return null;
  return (
    <div className="not-prose my-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-900 mb-3">🛍️ {heading || 'SK Trader recommends'}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {hits.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpenProduct(p)} className="text-left bg-white rounded-xl border p-2 hover:shadow-md transition cursor-pointer">
            {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="w-full aspect-square object-cover rounded-lg bg-slate-100" /> : <div className="w-full aspect-square rounded-lg bg-slate-100" />}
            <span className="block text-xs font-semibold text-slate-800 mt-1.5 line-clamp-2">{p.name}</span>
            <span className="block text-sm font-black text-amber-600">{price(p.discounted_price || p.price)}</span>
            <span className="block text-[11px] font-bold text-white bg-amber-600 rounded-lg text-center py-1 mt-1">Shop now</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Article text with product boxes in between
export function PostBody({ html, products, onOpenProduct }: { html: string; products: ShopProduct[]; onOpenProduct: (p: ShopProduct) => void }) {
  const clean = sanitizeHtml(html || '');
  const parts = clean.split(/\[\[\s*products\s*:([^\]]*)\]\]/i);
  return (
    <div className="rich-text article-text">
      {parts.map((part, i) => i % 2 === 1
        ? <ProductBox key={i} spec={part.replace(/&amp;/g, '&')} products={products} onOpenProduct={onOpenProduct} />
        : <div key={i} dangerouslySetInnerHTML={{ __html: part }} />)}
    </div>
  );
}

// ---------------- one page / article ----------------
export function PageView({ post, posts, products, store, onOpenProduct, onNavigate, onShop }: {
  post: Post | null | undefined; // undefined = still loading, null = not found
  posts: Post[];
  products: ShopProduct[];
  store: { name: string; phone: string; whatsapp: string; email: string; address: string };
  onOpenProduct: (p: ShopProduct) => void;
  onNavigate: (path: string) => void;
  onShop: () => void;
}) {
  if (post === undefined) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-400">Loading…</div>;
  if (post === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-slate-900">Page not found</h1>
        <p className="text-slate-500 mt-2">This page does not exist any more.</p>
        <button onClick={onShop} className="mt-6 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold cursor-pointer">Go to the shop</button>
      </div>
    );
  }
  const isBlog = post.kind === 'blog';
  const more = posts.filter((p) => p.kind === 'blog' && p.id !== post.id).slice(0, 3);
  const link = `https://www.sktraderpk.com${postPath(post)}`;
  const wa = (store.whatsapp || '').replace(/\D/g, '');
  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-500 mb-4 flex flex-wrap gap-1" aria-label="Breadcrumb">
        <button onClick={onShop} className="hover:text-amber-700 cursor-pointer">Home</button>
        {isBlog && <><span>/</span><button onClick={() => onNavigate('/blog')} className="hover:text-amber-700 cursor-pointer">Blog</button></>}
        <span>/</span><span className="text-slate-700 truncate max-w-[60vw]">{post.title}</span>
      </nav>
      <h1 className="site-heading text-2xl sm:text-4xl font-black text-slate-900 leading-tight">{post.title}</h1>
      {isBlog && (
        <p className="text-xs text-slate-500 mt-2">
          {store.name} · {fmtDate(post.created_at)} · {readMinutes(post.body || '')} min read
        </p>
      )}
      {post.cover_url && <img src={post.cover_url} alt={post.title} className="w-full rounded-2xl mt-5 object-cover max-h-[28rem] bg-slate-100" />}
      <div className="mt-6 bg-white rounded-2xl border p-5 sm:p-8">
        <PostBody html={post.body || ''} products={products} onOpenProduct={onOpenProduct} />

        {post.slug === 'contact' && (
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 text-white font-bold text-center py-3">WhatsApp us</a>}
            {store.phone && <a href={`tel:${store.phone.replace(/[^0-9+]/g, '')}`} className="rounded-xl bg-slate-900 text-white font-bold text-center py-3">Call {store.phone}</a>}
            {store.email && <a href={`mailto:${store.email}`} className="rounded-xl bg-amber-600 text-white font-bold text-center py-3">Email us</a>}
          </div>
        )}
      </div>

      {isBlog && (
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <span className="text-sm font-semibold text-slate-600">Share:</span>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title}\n${link}`)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold">WhatsApp</a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold">Facebook</a>
          <button onClick={onShop} className="ml-auto px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold cursor-pointer">Visit the shop →</button>
        </div>
      )}

      {isBlog && more.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-black text-slate-900 mb-3">More articles</h2>
          <BlogCards posts={more} onNavigate={onNavigate} />
        </div>
      )}
    </article>
  );
}

function BlogCards({ posts, onNavigate }: { posts: Post[]; onNavigate: (path: string) => void }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => (
        <a key={p.id} href={postPath(p)} onClick={(e) => { e.preventDefault(); onNavigate(postPath(p)); }} className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition block">
          {p.cover_url
            ? <img src={p.cover_url} alt={p.title} loading="lazy" className="w-full aspect-[16/9] object-cover bg-slate-100" />
            : <div className="w-full aspect-[16/9] bg-gradient-to-br from-amber-100 via-rose-50 to-amber-200 flex items-center justify-center text-4xl">💇‍♀️</div>}
          <div className="p-4">
            <h3 className="font-bold text-slate-900 leading-snug line-clamp-2">{p.title}</h3>
            {p.description && <p className="text-sm text-slate-500 mt-1 line-clamp-3">{p.description}</p>}
            <p className="text-xs text-amber-700 font-bold mt-2">Read more →</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export function BlogList({ posts, storeName, onNavigate, onShop }: { posts: Post[] | null; storeName: string; onNavigate: (path: string) => void; onShop: () => void }) {
  const blog = (posts || []).filter((p) => p.kind === 'blog');
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-500 mb-4 flex gap-1"><button onClick={onShop} className="hover:text-amber-700 cursor-pointer">Home</button><span>/</span><span className="text-slate-700">Blog</span></nav>
      <h1 className="site-heading text-3xl sm:text-4xl font-black text-slate-900">Hair & Beauty Tips</h1>
      <p className="text-slate-500 mt-1">Hair care, skin care and beauty advice from {storeName}.</p>
      <div className="mt-6">
        {posts === null ? <p className="text-slate-400">Loading…</p>
          : blog.length === 0 ? <p className="text-slate-400">No articles yet.</p>
          : <BlogCards posts={blog} onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

// ---------------- admin: Blog & Pages ----------------
async function uploadBlogImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not a picture.'));
      img.onload = () => {
        const scale = Math.min(1, 1400 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); }
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
  const blob = await (await fetch(dataUrl)).blob();
  const path = `blog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message + ' (run supabase_v22.sql once)');
  return supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
}

const emptyPost = (kind: 'page' | 'blog'): Partial<Post> => ({ kind, slug: '', title: '', description: '', cover_url: '', body: '', published: true, sort_order: 0 });

export function PagesAdmin({ adsense, onSaveAdsense, onChanged }: { adsense: string; onSaveAdsense: (v: string) => Promise<boolean>; onChanged: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [edit, setEdit] = useState<Partial<Post> | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ads, setAds] = useState(adsense);
  useEffect(() => setAds(adsense), [adsense]);

  const load = async () => {
    const { data, error } = await supabase.from('site_posts').select('*').order('kind').order('sort_order').order('created_at', { ascending: false });
    if (error) { setMsg(/site_posts/.test(error.message) ? 'Run supabase_v22.sql once in Supabase > SQL Editor to switch on Blog & Pages.' : error.message); setPosts([]); return; }
    setPosts((data || []) as Post[]);
  };
  useEffect(() => { load(); }, []);

  const pages = (posts || []).filter((p) => p.kind === 'page');
  const blog = (posts || []).filter((p) => p.kind === 'blog');

  const save = async () => {
    if (!edit) return;
    const title = (edit.title || '').trim();
    const slug = slugify(edit.slug || title);
    if (!title) { setMsg('Please write a title.'); return; }
    if (!slug) { setMsg('Please write a link name.'); return; }
    if (['blog', 'api', 'admin', 'sitemap', 'robots'].includes(slug)) { setMsg('This link name is reserved, please choose another.'); return; }
    setBusy(true); setMsg('');
    const row = {
      kind: edit.kind || 'blog', slug, title,
      description: (edit.description || '').trim() || htmlToText(edit.body || '').slice(0, 160),
      cover_url: (edit.cover_url || '').trim() || null,
      body: sanitizeHtml(edit.body || ''),
      published: edit.published !== false,
      sort_order: Number(edit.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };
    const res = edit.id
      ? await supabase.from('site_posts').update(row).eq('id', edit.id)
      : await supabase.from('site_posts').insert([row]);
    setBusy(false);
    if (res.error) { setMsg(/duplicate|unique/i.test(res.error.message) ? 'Another page already uses this link name.' : res.error.message); return; }
    setEdit(null); setMsg('Saved.'); load(); onChanged();
  };

  const remove = async (p: Post) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('site_posts').delete().eq('id', p.id);
    if (error) { setMsg(error.message); return; }
    load(); onChanged();
  };

  const input = 'w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500';
  const lbl = 'block text-xs font-bold text-slate-700 mb-1';

  if (edit) {
    const descLen = (edit.description || '').length;
    return (
      <div className="bg-white rounded-3xl p-5 sm:p-6 border shadow-sm space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <h3 className="text-lg font-extrabold text-slate-900">{edit.id ? 'Edit' : 'New'} {edit.kind === 'page' ? 'page' : 'article'}</h3>
          <button onClick={() => setEdit(null)} className="text-sm text-slate-500 underline cursor-pointer">Back</button>
        </div>
        <div>
          <label className={lbl}>Title (H1) *</label>
          <input className={input + ' text-base font-bold'} value={edit.title || ''} placeholder="e.g. Baalon Ka Girna Kaise Rokein?"
            onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: slugTouched || edit.id ? edit.slug : slugify(e.target.value) })} />
        </div>
        <div className="grid sm:grid-cols-[1fr_10rem] gap-3">
          <div>
            <label className={lbl}>Link</label>
            <div className="flex items-center">
              <span className="px-2 py-2 text-xs text-slate-500 bg-slate-100 border border-r-0 rounded-l-xl whitespace-nowrap">sktraderpk.com/{edit.kind === 'blog' ? 'blog/' : ''}</span>
              <input className={input + ' rounded-l-none'} value={edit.slug || ''} onChange={(e) => { setSlugTouched(true); setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }); }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select className={input} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as any })}>
              <option value="blog">Blog article</option>
              <option value="page">Page (footer)</option>
            </select>
          </div>
        </div>
        <div>
          <label className={lbl}>Short summary for Google (meta description) <span className={descLen > 160 ? 'text-red-600' : 'text-slate-400'}>{descLen}/160</span></label>
          <textarea className={input} rows={2} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="1-2 sentences with the words people search on Google." />
        </div>
        <div>
          <label className={lbl}>Main picture (featured image)</label>
          <div className="flex flex-wrap items-center gap-3">
            {edit.cover_url && <img src={edit.cover_url} alt="" className="h-20 rounded-lg border object-cover" />}
            <label className="px-3 py-2 rounded-xl border bg-slate-50 text-sm font-semibold cursor-pointer">
              {edit.cover_url ? 'Change picture' : 'Upload picture'}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setBusy(true); setMsg('');
                try { const u = await uploadBlogImage(f); setEdit((x) => x ? { ...x, cover_url: u } : x); } catch (err: any) { setMsg(err.message); }
                setBusy(false);
              }} />
            </label>
            {edit.cover_url && <button type="button" onClick={() => setEdit({ ...edit, cover_url: '' })} className="text-xs text-red-600 underline cursor-pointer">Remove</button>}
          </div>
        </div>
        <div>
          <label className={lbl}>Text</label>
          <RichTextEditor article value={edit.body || ''} onChange={(h) => setEdit((x) => x ? { ...x, body: h } : x)} onUploadImage={uploadBlogImage} placeholder="Write the article…" />
          <p className="text-[11px] text-slate-500 mt-1">
            Tips: use <b>H2</b> for each section heading. <b>🖼 Picture</b> adds a picture where the cursor is. <b>🛍 Products</b> adds a box with your shop's products
            (it shows products whose name contains the words you type).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={edit.published !== false} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Published (visible on the website)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">Order <input className={input + ' w-20'} inputMode="numeric" value={String(edit.sort_order || 0)} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value.replace(/[^0-9-]/g, '')) || 0 })} /></label>
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={save} className="px-6 py-2.5 rounded-xl bg-slate-900 text-amber-400 font-bold disabled:opacity-50 cursor-pointer">{busy ? 'Please wait…' : 'Save'}</button>
          <button onClick={() => setEdit(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  const row = (p: Post) => (
    <div key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 border-b last:border-0">
      {p.kind === 'blog' && (p.cover_url ? <img src={p.cover_url} alt="" className="w-14 h-10 rounded object-cover" /> : <div className="w-14 h-10 rounded bg-amber-100" />)}
      <div className="flex-1 min-w-[12rem]">
        <p className="font-semibold text-slate-800">{p.title} {!p.published && <span className="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5 py-0.5 ml-1">HIDDEN</span>}</p>
        <a href={postPath(p)} target="_blank" rel="noreferrer" className="text-xs text-amber-700 underline">sktraderpk.com{postPath(p)}</a>
      </div>
      <button onClick={() => { setSlugTouched(false); setMsg(''); setEdit({ ...p }); }} className="px-3 py-1.5 rounded-lg border text-sm font-semibold cursor-pointer">Edit</button>
      <button onClick={() => remove(p)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold cursor-pointer">Delete</button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      {msg && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">{msg}</div>}
      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
          <h3 className="text-lg font-extrabold text-slate-900">Blog articles ({blog.length})</h3>
          <button onClick={() => { setSlugTouched(false); setMsg(''); setEdit(emptyPost('blog')); }} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold cursor-pointer">+ New article</button>
        </div>
        {posts === null ? <p className="text-slate-400 text-sm">Loading…</p> : blog.length ? blog.map(row) : <p className="text-sm text-slate-400">No articles yet.</p>}
        <p className="text-[11px] text-slate-500 mt-3">Write 1-2 articles every week about problems people search on Google (hair fall, dandruff, hair colour, skin care). Each article brings visitors and shows your products.</p>
      </div>
      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
          <h3 className="text-lg font-extrabold text-slate-900">Pages ({pages.length})</h3>
          <button onClick={() => { setSlugTouched(false); setMsg(''); setEdit(emptyPost('page')); }} className="px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer">+ New page</button>
        </div>
        {posts === null ? <p className="text-slate-400 text-sm">Loading…</p> : pages.map(row)}
        <p className="text-[11px] text-slate-500 mt-3">All published pages are linked in the website footer automatically.</p>
      </div>
      <div className="bg-white rounded-3xl p-5 border shadow-sm space-y-2">
        <h3 className="text-lg font-extrabold text-slate-900 border-b pb-2">Google AdSense</h3>
        <p className="text-xs text-slate-500">
          After you apply on adsense.google.com, Google shows your publisher ID (it looks like <b>ca-pub-1234567890123456</b>).
          Paste it here and save: the AdSense code is then added to every page and <b>sktraderpk.com/ads.txt</b> is created automatically.
        </p>
        <div className="flex gap-2 max-w-lg">
          <input className={input} placeholder="ca-pub-…" value={ads} onChange={(e) => setAds(e.target.value.trim())} />
          <button onClick={async () => {
            const v = ads.trim();
            if (v && !/^ca-pub-\d{10,20}$/.test(v)) { setMsg('The ID must look like ca-pub-1234567890123456'); return; }
            setMsg((await onSaveAdsense(v)) ? 'AdSense ID saved.' : 'Could not save (run supabase_v22.sql once).');
          }} className="px-4 rounded-xl bg-slate-900 text-amber-400 text-sm font-bold cursor-pointer">Save</button>
        </div>
      </div>
    </div>
  );
}

// Footer links to the info pages and the blog
export function useFooterPages(posts: Post[] | null) {
  return useMemo(() => (posts || []).filter((p) => p.kind === 'page'), [posts]);
}
