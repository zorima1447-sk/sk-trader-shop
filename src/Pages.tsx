import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { RichTextEditor, sanitizeHtml, htmlToText } from './RichText';
import { price } from './currency';
import { track, visitorId } from './analytics';
import { ReturnForm } from './Returns';
import { BrandIcon } from './SocialIcons';

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
  publish_at?: string | null;   // future time = scheduled (published automatically at that time)
  translations?: Translations | null;
}

export type Tr = { title: string; description: string; body: string };
export type Translations = { _orig?: LangKey } & Partial<Record<LangKey, Tr>>;
export type LangKey = 'roman' | 'en' | 'ur' | 'hi';
export const LANGS: Record<LangKey, { label: string; name: string; rtl?: boolean; html: string }> = {
  roman: { label: 'Roman Urdu', name: 'Roman Urdu', html: 'ur-Latn' },
  en: { label: 'English', name: 'English', html: 'en' },
  ur: { label: 'اردو', name: 'Urdu', rtl: true, html: 'ur' },
  hi: { label: 'हिंदी', name: 'Hindi', html: 'hi' },
};
export const origLang = (p: Pick<Post, 'kind' | 'translations'>): LangKey => (p.translations?._orig as LangKey) || (p.kind === 'blog' ? 'roman' : 'en');
// the languages a post can be read in (its own one first)
export function postLangs(p: Post): LangKey[] {
  const o = origLang(p);
  const t = p.translations || {};
  return [o, ...(['roman', 'en', 'ur', 'hi'] as LangKey[]).filter((k) => k !== o && (t as any)[k] && (t as any)[k].body)];
}
export function postIn(p: Post, lang: LangKey): Tr {
  const t = lang === origLang(p) ? null : (p.translations as any)?.[lang];
  return t && t.body ? { title: t.title || p.title, description: t.description || p.description || '', body: t.body } : { title: p.title, description: p.description || '', body: p.body || '' };
}
let urduFont = false;
function loadUrduFont() {
  if (urduFont) return; urduFont = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap';
  document.head.appendChild(l);
}

type Ads = { client: string; slot: string; on: boolean };

// One Google ad (shown only when AdSense is set up and an ad unit ID is saved)
export function AdUnit({ ads, className = '' }: { ads?: Ads; className?: string }) {
  useEffect(() => {
    if (!ads || !ads.on || !ads.client || !ads.slot) return;
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* ignore */ }
  }, [ads?.client, ads?.slot, ads?.on]);
  if (!ads || !ads.on || !ads.client || !ads.slot) return null;
  return (
    <div className={`my-6 ${className}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-1">Advertisement</p>
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={ads.client} data-ad-slot={ads.slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}

type ShopProduct = { id: string; name: string; price: number; discounted_price?: number; original_price?: number; image_url?: string; category_name?: string; stock_quantity?: number };

export const PAGE_SLUGS = ['about', 'contact', 'privacy-policy', 'terms-and-conditions', 'returns'];

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

// visible to readers: published and its publish time has come
export const isLive = (p: Pick<Post, 'published' | 'publish_at'>) => !!p.published && (!p.publish_at || new Date(p.publish_at).getTime() <= Date.now());
export const postDate = (p: Pick<Post, 'publish_at' | 'created_at'>) => p.publish_at || p.created_at;

export async function fetchPosts(all = false): Promise<Post[]> {
  let q = supabase.from('site_posts').select('*');
  if (!all) q = q.eq('published', true);
  const { data, error } = await q.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) return [];
  const list = (data || []) as Post[];
  // newest article first (by its publish date); scheduled ones stay hidden until their time
  return (all ? list : list.filter(isLive)).sort((a, b) => (a.kind !== b.kind ? 0 : a.sort_order - b.sort_order || new Date(postDate(b)).getTime() - new Date(postDate(a)).getTime()));
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
export function PostBody({ html, products, onOpenProduct, ads, rtl }: { html: string; products: ShopProduct[]; onOpenProduct: (p: ShopProduct) => void; ads?: Ads; rtl?: boolean }) {
  const clean = sanitizeHtml(html || '');
  // [[products: ...]] = product box, [[ad]] = a Google ad, [[youtube: link]] = a video at this place
  const parts = clean.split(/\[\[\s*(products\s*:[^\]]*|youtube\s*:[^\]]*|ad)\s*\]\]/i);
  return (
    <div className={`rich-text article-text ${rtl ? 'urdu-text' : ''}`} dir={rtl ? 'rtl' : undefined}>
      {parts.map((part, i) => i % 2 === 1
        ? (/^ad$/i.test(part.trim())
          ? <div key={i} dir="ltr"><AdUnit ads={ads} /></div>
          : /^youtube\s*:/i.test(part.trim())
          ? <YouTubeEmbed key={i} url={part.replace(/^\s*youtube\s*:/i, '').replace(/&amp;/g, '&').trim()} />
          : <div key={i} dir="ltr"><ProductBox spec={part.replace(/^products\s*:/i, '').replace(/&amp;/g, '&')} products={products} onOpenProduct={onOpenProduct} /></div>)
        : <div key={i} dangerouslySetInnerHTML={{ __html: part }} />)}
    </div>
  );
}

// YouTube video inside an article (privacy-friendly player)
export const youtubeId = (url: string) => {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
};
function YouTubeEmbed({ url }: { url: string }) {
  const id = youtubeId(url);
  if (!id) return null;
  return (
    <div className="my-6" dir="ltr">
      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );
}

// Share an article: WhatsApp, Facebook, Instagram (phone share menu / copy link), copy link
const isPhone = () => {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
};

export function ShareButtons({ title, link, small = false }: { title: string; link: string; small?: boolean }) {
  const [note, setNote] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); return true; } catch { /* old browser */ }
    try {
      const t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch { return false; }
  };
  const insta = async () => {
    // Instagram has no "share this link" page for websites.
    // Phone: the phone's share menu lists the Instagram app (Story / Direct message).
    const nav: any = navigator;
    if (isPhone() && nav.share) {
      try { await nav.share({ title, text: title, url: link }); } catch { /* closed */ }
      return;
    }
    // Computer: open Instagram at once (before anything else, so the browser does not block it) and copy the link
    window.open('https://www.instagram.com/', '_blank', 'noopener');
    const ok = await copy();
    setNote(ok ? 'Instagram opened in a new tab and the link is copied - paste it in your post caption, story (link sticker), bio or a message.' : `Copy this link for Instagram: ${link}`);
  };
  const size = small ? 'w-8 h-8' : 'w-10 h-10';
  const icon = small ? 'w-4 h-4' : 'w-5 h-5';
  const btn = `${size} rounded-full flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform cursor-pointer`;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${link}`)}`} target="_blank" rel="noreferrer" className={btn} style={{ background: '#25D366' }} title="Share on WhatsApp" aria-label="Share on WhatsApp"><BrandIcon net="whatsapp" className={icon} /></a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className={btn} style={{ background: '#1877F2' }} title="Share on Facebook" aria-label="Share on Facebook"><BrandIcon net="facebook" className={icon} /></a>
      <button type="button" onClick={insta} className={btn} style={{ background: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)' }} title="Share on Instagram" aria-label="Share on Instagram"><BrandIcon net="instagram" className={icon} /></button>
      <button type="button" onClick={async () => setNote((await copy()) ? 'Link copied!' : link)} className={`${small ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-sm'} rounded-full border bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer`} title="Copy link">🔗{small ? '' : ' Copy link'}</button>
      {note && <span className="w-full text-xs text-slate-600">{note}</span>}
    </span>
  );
}

// ---------------- likes, views, comments under an article ----------------
function PostSocial({ slug, defaultName }: { slug: string; defaultName?: string }) {
  const [info, setInfo] = useState<{ views: number; likes: number; liked: boolean; comments: { name: string; body: string; created_at: string }[] } | null>(null);
  const [name, setName] = useState(defaultName || '');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const vid = visitorId();
  useEffect(() => {
    let alive = true;
    supabase.rpc('post_public', { p_slug: slug, p_visitor: vid }).then(({ data }: any) => { if (alive && data && typeof data === 'object' && !Array.isArray(data)) setInfo({ views: 0, likes: 0, liked: false, comments: [], ...data }); });
    return () => { alive = false; };
  }, [slug]);
  useEffect(() => { if (defaultName && !name) setName(defaultName); }, [defaultName]);
  if (!info) return null;
  const like = async () => {
    setInfo({ ...info, liked: !info.liked, likes: info.likes + (info.liked ? -1 : 1) });
    const { data, error } = await supabase.rpc('post_like', { p_slug: slug, p_visitor: vid });
    if (!error && data) setInfo((x) => x ? { ...x, ...(data as any) } : x);
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (!name.trim() || text.trim().length < 3) { setMsg('Please write your name and comment.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('post_comment', { p_slug: slug, p_name: name, p_body: text, p_visitor: vid });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setText(''); setMsg('Shukriya! Your comment will appear after approval.');
  };
  return (
    <div className="mt-6 bg-white rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={like} className={`flex items-center gap-1.5 px-4 py-2 rounded-full border-2 font-bold text-sm cursor-pointer transition ${info.liked ? 'bg-rose-600 border-rose-600 text-white' : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`} aria-pressed={info.liked}>
          {info.liked ? '♥' : '♡'} {info.liked ? 'Liked' : 'Like'} · {info.likes}
        </button>
        <span className="text-sm text-slate-500">👁 {Number(info.views).toLocaleString('en-PK')} views</span>
        <span className="text-sm text-slate-500">💬 {info.comments.length} comments</span>
      </div>
      <h2 id="comments" className="text-lg font-black text-slate-900 mt-5 mb-2 scroll-mt-24">Comments</h2>
      {info.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet. Be the first!</p>}
      <div className="space-y-3">
        {info.comments.map((c, i) => (
          <div key={i} className="flex gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center">{c.name.slice(0, 1).toUpperCase()}</span>
            <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-sm font-bold text-slate-800">{c.name} <span className="text-[11px] font-normal text-slate-400">{fmtDate(c.created_at)}</span></p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-4 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} className="w-full sm:w-72 px-3 py-2 border rounded-lg text-sm" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment or question…" rows={3} maxLength={1500} className="w-full px-3 py-2 border rounded-lg text-sm" />
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">{busy ? 'Sending…' : 'Post comment'}</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

// ---------------- one page / article ----------------
export function PageView({ post, posts, products, store, onOpenProduct, onNavigate, onShop, ads, customerName }: {
  post: Post | null | undefined; // undefined = still loading, null = not found
  posts: Post[];
  products: ShopProduct[];
  store: { name: string; phone: string; whatsapp: string; email: string; address: string };
  onOpenProduct: (p: ShopProduct) => void;
  onNavigate: (path: string) => void;
  onShop: () => void;
  ads?: Ads;
  customerName?: string;
}) {
  const [lang, setLang] = useState<LangKey | ''>(() => { try { return (new URLSearchParams(window.location.search).get('lang') || '') as any; } catch { return ''; } });
  useEffect(() => {
    if (post && post.kind === 'blog') track('post_view');
  }, [post?.id]);
  const langs = post ? postLangs(post) : [];
  const cur: LangKey = post && lang && langs.includes(lang as LangKey) ? (lang as LangKey) : (post ? origLang(post) : 'en');
  useEffect(() => { if (cur === 'ur') loadUrduFont(); }, [cur]);
  const chooseLang = (k: LangKey) => {
    setLang(k);
    try {
      const u = new URL(window.location.href);
      if (post && k === origLang(post)) u.searchParams.delete('lang'); else u.searchParams.set('lang', k);
      window.history.replaceState(window.history.state, '', u.pathname + u.search);
    } catch { /* ignore */ }
  };
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
  const link = `https://www.sktraderpk.com${postPath(post)}${cur !== origLang(post) ? `?lang=${cur}` : ''}`;
  const tx = postIn(post, cur);
  const rtl = !!LANGS[cur].rtl;
  const wa = (store.whatsapp || '').replace(/\D/g, '');
  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-xs text-slate-500 mb-4 flex flex-wrap gap-1" aria-label="Breadcrumb">
        <button onClick={onShop} className="hover:text-amber-700 cursor-pointer">Home</button>
        {isBlog && <><span>/</span><button onClick={() => onNavigate('/blog')} className="hover:text-amber-700 cursor-pointer">Blog</button></>}
        <span>/</span><span className="text-slate-700 truncate max-w-[60vw]">{post.title}</span>
      </nav>
      {langs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3" role="group" aria-label="Language">
          <span className="text-xs font-semibold text-slate-500 mr-1">Read in:</span>
          {langs.map((k) => (
            <button key={k} onClick={() => chooseLang(k)} lang={LANGS[k].html}
              className={`px-3 py-1 rounded-full text-sm font-semibold border cursor-pointer ${cur === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{LANGS[k].label}</button>
          ))}
        </div>
      )}
      <h1 lang={LANGS[cur].html} dir={rtl ? 'rtl' : undefined} className={`site-heading text-2xl sm:text-4xl font-black text-slate-900 leading-tight ${rtl ? 'urdu-text' : ''}`}>{tx.title}</h1>
      {isBlog && (
        <p className="text-xs text-slate-500 mt-2">
          {store.name} · {fmtDate(postDate(post))} · {readMinutes(tx.body || '')} min read
        </p>
      )}
      {post.cover_url && <img src={post.cover_url} alt={post.title} className="w-full rounded-2xl mt-5 object-cover max-h-[28rem] bg-slate-100" />}
      <div className="mt-6 bg-white rounded-2xl border p-5 sm:p-8">
        <div lang={LANGS[cur].html}><PostBody html={tx.body} products={products} onOpenProduct={onOpenProduct} ads={ads} rtl={rtl} /></div>
        {isBlog && <AdUnit ads={ads} />}

        {post.slug === 'returns' && <ReturnForm whatsapp={store.whatsapp} />}

        {post.slug === 'contact' && (
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 text-white font-bold text-center py-3">WhatsApp us</a>}
            {store.phone && <a href={`tel:${store.phone.replace(/[^0-9+]/g, '')}`} className="rounded-xl bg-slate-900 text-white font-bold text-center py-3">Call {store.phone}</a>}
            {store.email && <a href={`mailto:${store.email}`} className="rounded-xl bg-amber-600 text-white font-bold text-center py-3">Email us</a>}
          </div>
        )}
      </div>

      {isBlog && <PostSocial slug={post.slug} defaultName={customerName} />}

      {isBlog && (
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <span className="text-sm font-semibold text-slate-600">Share:</span>
          <ShareButtons title={tx.title} link={link} />
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

type Counts = Record<string, { views: number; likes: number; comments: number; liked: boolean }>;

function BlogCards({ posts, onNavigate }: { posts: Post[]; onNavigate: (path: string) => void }) {
  const [counts, setCounts] = useState<Counts>({});
  const [shareOpen, setShareOpen] = useState('');
  const vid = visitorId();
  useEffect(() => {
    supabase.rpc('post_counts', { p_visitor: vid }).then(({ data, error }: any) => {
      if (!error && Array.isArray(data)) setCounts(Object.fromEntries(data.map((x: any) => [x.slug, { views: Number(x.views) || 0, likes: Number(x.likes) || 0, comments: Number(x.comments) || 0, liked: !!x.liked }])));
    });
  }, [posts.length]);
  const like = async (slug: string) => {
    const c = counts[slug] || { views: 0, likes: 0, comments: 0, liked: false };
    setCounts({ ...counts, [slug]: { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } });
    const { data, error } = await supabase.rpc('post_like', { p_slug: slug, p_visitor: vid });
    if (!error && data) setCounts((x) => ({ ...x, [slug]: { ...(x[slug] || c), ...(data as any) } }));
  };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => {
        const c = counts[p.slug];
        const open = (e: React.MouseEvent) => { e.preventDefault(); onNavigate(postPath(p)); };
        const link = `https://www.sktraderpk.com${postPath(p)}`;
        return (
          <div key={p.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition flex flex-col">
            <a href={postPath(p)} onClick={open} className="block">
              {p.cover_url
                ? <img src={p.cover_url} alt={p.title} loading="lazy" className="w-full aspect-[16/9] object-cover bg-slate-100" />
                : <div className="w-full aspect-[16/9] bg-gradient-to-br from-amber-100 via-rose-50 to-amber-200 flex items-center justify-center text-4xl">💇‍♀️</div>}
            </a>
            <div className="p-4 flex-1 flex flex-col">
              <a href={postPath(p)} onClick={open}><h3 className="font-bold text-slate-900 leading-snug line-clamp-2 hover:text-amber-700">{p.title}</h3></a>
              {p.description && <p className="text-sm text-slate-500 mt-1 line-clamp-3">{p.description}</p>}
              <a href={postPath(p)} onClick={open} className="text-xs text-amber-700 font-bold mt-2">Read more →</a>
              <div className="mt-auto pt-3 border-t flex items-center gap-3 text-sm text-slate-500">
                <span title="Views">👁 {c ? c.views.toLocaleString('en-PK') : '–'}</span>
                <button type="button" onClick={() => like(p.slug)} className={`flex items-center gap-1 font-semibold cursor-pointer ${c?.liked ? 'text-rose-600' : 'hover:text-rose-600'}`} aria-pressed={!!c?.liked} title={c?.liked ? 'Unlike' : 'Like'}>
                  {c?.liked ? '♥' : '♡'} {c ? c.likes : '–'}
                </button>
                <a href={`${postPath(p)}#comments`} onClick={(e) => { e.preventDefault(); onNavigate(postPath(p)); setTimeout(() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' }), 400); }} className="hover:text-slate-800" title="Comments">💬 {c ? c.comments : '–'}</a>
                <button type="button" onClick={() => setShareOpen(shareOpen === p.id ? '' : p.id)} className="ml-auto px-2.5 py-1 rounded-full border text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">↗ Share</button>
              </div>
              {shareOpen === p.id && <div className="pt-2"><ShareButtons title={p.title} link={link} small /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BlogList({ posts, storeName, onNavigate, onShop, ads }: { posts: Post[] | null; storeName: string; onNavigate: (path: string) => void; onShop: () => void; ads?: Ads }) {
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
      <AdUnit ads={ads} />
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

const emptyPost = (kind: 'page' | 'blog'): Partial<Post> => ({ kind, slug: '', title: '', description: '', cover_url: '', body: '', published: true, sort_order: 0, translations: { _orig: kind === 'blog' ? 'roman' : 'en' } });

// Cuts article HTML into pieces of about `max` characters, only between paragraphs / headings / lists
export function splitHtml(html: string, max: number): string[] {
  const blocks = String(html || '').split(/(?<=<\/(?:p|h2|h3|ul|ol|blockquote|div)>)/i).filter((b) => b.trim());
  const out: string[] = [];
  let cur = '';
  for (const b of blocks) {
    if (cur && cur.length + b.length > max) { out.push(cur); cur = ''; }
    cur += b;
  }
  if (cur.trim()) out.push(cur);
  return out.length ? out : [html];
}

// ISO time -> value for <input type="datetime-local"> (the admin's own clock)
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Stat = { id: string; views: number; readers: number; views_all: number; likes: number; comments: number; pending: number };

export function PagesAdmin({ settings, onSaveAds, onChanged }: {
  settings: { adsense_client: string; ads_place: 'blog' | 'all'; adsense_slot: string };
  onSaveAds: (v: { adsense_client: string; ads_place: 'blog' | 'all'; adsense_slot: string }) => Promise<boolean>;
  onChanged: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [comments, setComments] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<Partial<Post> | null>(null);
  const [tab, setTab] = useState<LangKey>('roman');
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState('');
  const [pubMode, setPubMode] = useState<'now' | 'schedule' | 'draft'>('now');
  const [pubAt, setPubAt] = useState('');
  const [autoStart, setAutoStart] = useState(() => toLocalInput(new Date(Date.now() + 86400000).toISOString()).slice(0, 10));
  const [autoTime, setAutoTime] = useState('10:00');
  const openEdit = (p: Partial<Post>) => {
    setSlugTouched(false); setMsg('');
    const future = !!p.publish_at && new Date(p.publish_at).getTime() > Date.now();
    setPubMode(p.published === false ? 'draft' : future ? 'schedule' : 'now');
    setPubAt(p.publish_at ? toLocalInput(p.publish_at) : '');
    setEdit(p);
  };
  const publishNow = async (p: Post) => {
    const { error } = await supabase.from('site_posts').update({ published: true, publish_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { setMsg(error.message); return; }
    setMsg(`"${p.title}" is now live.`); load(); onChanged();
  };
  // one article per day: every blog article that is not live yet gets the next free day
  const autoSchedule = async () => {
    const waiting = (posts || []).filter((p) => p.kind === 'blog' && !isLive(p))
      .sort((a, b) => (a.publish_at || '9').localeCompare(b.publish_at || '9') || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    if (!waiting.length) { setMsg('All articles are already live - nothing to schedule.'); return; }
    if (!window.confirm(`Schedule ${waiting.length} article(s): one per day from ${autoStart} at ${autoTime}?`)) return;
    const [hh, mm] = autoTime.split(':').map(Number);
    for (let i = 0; i < waiting.length; i++) {
      const d = new Date(`${autoStart}T00:00`);
      d.setDate(d.getDate() + i); d.setHours(hh || 10, mm || 0, 0, 0);
      const { error } = await supabase.from('site_posts').update({ published: true, publish_at: d.toISOString() }).eq('id', waiting[i].id);
      if (error) { setMsg(error.message + (/publish_at/.test(error.message) ? ' (run supabase_v28.sql)' : '')); return; }
    }
    setMsg(`${waiting.length} article(s) scheduled - one will appear on the website every day at ${autoTime}.`);
    load(); onChanged();
  };
  const [msg, setMsg] = useState('');
  const [ads, setAds] = useState(settings);
  useEffect(() => setAds(settings), [settings.adsense_client, settings.ads_place, settings.adsense_slot]);

  const load = async () => {
    const { data, error } = await supabase.from('site_posts').select('*').order('kind').order('sort_order').order('created_at', { ascending: false });
    if (error) { setMsg(/site_posts/.test(error.message) ? 'Run supabase_v22.sql and supabase_v23.sql once in Supabase > SQL Editor to switch on Blog & Pages.' : error.message); setPosts([]); return; }
    setPosts((data || []) as Post[]);
    const st = await supabase.rpc('admin_blog_stats', { p_days: 30 });
    if (!st.error) setStats(Object.fromEntries(((st.data as any[]) || []).map((x) => [x.id, x])));
    const cm = await supabase.rpc('admin_comments');
    setComments(cm.error ? null : ((cm.data as any[]) || []));
  };
  useEffect(() => { load(); }, []);

  const pages = (posts || []).filter((p) => p.kind === 'page');
  const blog = (posts || []).filter((p) => p.kind === 'blog');
  const pendingCount = (comments || []).filter((c) => !c.approved).length;

  const orig: LangKey = (edit?.translations?._orig as LangKey) || (edit?.kind === 'blog' ? 'roman' : 'en');
  const trOf = (k: LangKey): Tr => (k === orig
    ? { title: edit?.title || '', description: edit?.description || '', body: edit?.body || '' }
    : ((edit?.translations as any)?.[k] || { title: '', description: '', body: '' }));
  const setTr = (k: LangKey, patch: Partial<Tr>) => setEdit((x) => {
    if (!x) return x;
    const o: LangKey = (x.translations?._orig as LangKey) || (x.kind === 'blog' ? 'roman' : 'en');
    if (k === o) {
      const n: any = { ...x };
      if (patch.title !== undefined) { n.title = patch.title; if (!slugTouched && !x.id) n.slug = slugify(patch.title); }
      if (patch.description !== undefined) n.description = patch.description;
      if (patch.body !== undefined) n.body = patch.body;
      return n;
    }
    const t: any = { ...(x.translations || {}) };
    t[k] = { ...(t[k] || { title: '', description: '', body: '' }), ...patch };
    return { ...x, translations: t };
  });

  // AI translation, a few paragraphs at a time (a long article in one go takes too long)
  const translate = async (k: LangKey) => {
    if (!edit || !(edit.body || '').trim()) { setMsg('Write the original text first.'); return; }
    if (trOf(k).body && !window.confirm(`Replace the current ${LANGS[k].name} text with a new AI translation?`)) return;
    const chunks = splitHtml(edit.body || '', 1800);
    setMsg('');
    const call = async (body: string, withHead: boolean) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: { mode: 'translate', lang: k, title: withHead ? edit.title : '', description: withHead ? edit.description : '', body },
        });
        const d: any = data;
        if (!error && d && !d.error && typeof d.body === 'string') return d;
        if (attempt === 2) throw new Error((d && d.error) || (error && error.message) || 'unknown error');
        await new Promise((r) => setTimeout(r, 2500));
      }
    };
    try {
      const out: string[] = [];
      let head: any = null;
      for (let n = 0; n < chunks.length; n++) {
        setAiBusy(`${k}:${n + 1}/${chunks.length}`);
        const d = await call(chunks[n], n === 0);
        if (n === 0) head = d;
        out.push(d.body);
      }
      setTr(k, { title: head?.title || '', description: head?.description || '', body: sanitizeHtml(out.join('\n')) });
      setTab(k);
      setMsg(`${LANGS[k].name} translation added - please read it once, then Save.`);
    } catch (e: any) {
      setMsg('Translation failed: ' + (e?.message || e) + '. Please try again in a minute (the free AI is sometimes busy).');
    } finally {
      setAiBusy('');
    }
  };

  const save = async () => {
    if (!edit) return;
    const title = (edit.title || '').trim();
    const slug = slugify(edit.slug || title);
    if (!title) { setMsg('Please write a title.'); return; }
    if (!slug) { setMsg('Please write a link name.'); return; }
    if (['blog', 'api', 'admin', 'sitemap', 'robots', 'assets'].includes(slug)) { setMsg('This link name is reserved, please choose another.'); return; }
    setBusy(true); setMsg('');
    const t: any = { _orig: orig };
    (['roman', 'en', 'ur', 'hi'] as LangKey[]).forEach((k) => {
      if (k === orig) return;
      const v = (edit.translations as any)?.[k];
      if (v && (v.body || '').trim()) t[k] = { title: (v.title || '').trim(), description: (v.description || '').trim(), body: sanitizeHtml(v.body) };
    });
    const row: any = {
      kind: edit.kind || 'blog', slug, title,
      description: (edit.description || '').trim() || htmlToText(edit.body || '').slice(0, 160),
      cover_url: (edit.cover_url || '').trim() || null,
      body: sanitizeHtml(edit.body || ''),
      published: edit.published !== false,
      publish_at: pubMode === 'schedule'
        ? (pubAt ? new Date(pubAt).toISOString() : null)
        : (edit.publish_at && new Date(edit.publish_at).getTime() <= Date.now() ? edit.publish_at : (edit.published !== false ? new Date().toISOString() : (edit.publish_at || null))),
      sort_order: Number(edit.sort_order) || 0,
      translations: t,
      updated_at: new Date().toISOString(),
    };
    let res = edit.id ? await supabase.from('site_posts').update(row).eq('id', edit.id) : await supabase.from('site_posts').insert([row]);
    if (res.error && /publish_at/.test(res.error.message)) {
      // database not updated yet (supabase_v28.sql): save without the schedule
      delete row.publish_at;
      res = edit.id ? await supabase.from('site_posts').update(row).eq('id', edit.id) : await supabase.from('site_posts').insert([row]);
      if (!res.error && pubMode === 'schedule') setMsg('Saved and published now - scheduling needs supabase_v28.sql.');
    }
    if (res.error && /translations/.test(res.error.message)) {
      // database not updated yet (supabase_v23.sql): save without the translations
      delete row.translations;
      res = edit.id ? await supabase.from('site_posts').update(row).eq('id', edit.id) : await supabase.from('site_posts').insert([row]);
      if (!res.error) setMsg('Saved, but translations need supabase_v23.sql.');
    }
    setBusy(false);
    if (res.error) { setMsg(/duplicate|unique/i.test(res.error.message) ? 'Another page already uses this link name.' : res.error.message); return; }
    setEdit(null); if (!res.error) setMsg((m) => m || 'Saved.'); load(); onChanged();
  };

  const remove = async (p: Post) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('site_posts').delete().eq('id', p.id);
    if (error) { setMsg(error.message); return; }
    load(); onChanged();
  };

  const commentSet = async (c: any, approved: boolean | null) => {
    if (approved === null && !window.confirm('Delete this comment?')) return;
    const { error } = await supabase.rpc('admin_comment_set', { p_id: c.id, p_approved: approved });
    if (error) { setMsg(error.message); return; }
    load();
  };

  const input = 'w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500';
  const lbl = 'block text-xs font-bold text-slate-700 mb-1';

  if (edit) {
    const cur = trOf(tab);
    const isOrig = tab === orig;
    const descLen = (cur.description || '').length;
    return (
      <div className="bg-white rounded-3xl p-5 sm:p-6 border shadow-sm space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <h3 className="text-lg font-extrabold text-slate-900">{edit.id ? 'Edit' : 'New'} {edit.kind === 'page' ? 'page' : 'article'}</h3>
          <button onClick={() => setEdit(null)} className="text-sm text-slate-500 underline cursor-pointer">Back</button>
        </div>

        <div className="grid sm:grid-cols-[1fr_10rem_10rem] gap-3">
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
          <div>
            <label className={lbl}>Written in</label>
            <select className={input} value={orig} onChange={(e) => { const k = e.target.value as LangKey; setEdit({ ...edit, translations: { ...(edit.translations || {}), _orig: k } }); setTab(k); }}>
              {(Object.keys(LANGS) as LangKey[]).map((k) => <option key={k} value={k}>{LANGS[k].name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b">
          {(['roman', 'en', 'ur', 'hi'] as LangKey[]).map((k) => {
            const has = k === orig || !!(trOf(k).body || '').trim();
            return (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-bold rounded-t-lg border border-b-0 -mb-px cursor-pointer ${tab === k ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-500'}`}>
                {LANGS[k].name}{k === orig ? ' (original)' : has ? ' ✓' : ''}
              </button>
            );
          })}
          {!isOrig && (
            <button type="button" disabled={!!aiBusy} onClick={() => translate(tab)} className="ml-auto mb-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              {aiBusy.startsWith(tab + ':') ? `Translating… part ${aiBusy.split(':')[1]}` : `✨ Translate to ${LANGS[tab].name} with AI`}
            </button>
          )}
        </div>
        {!isOrig && <p className="text-[11px] text-slate-500 -mt-2">Readers see a language button on the article for every language that has a text. Leave it empty if you don't want this language.</p>}

        <div>
          <label className={lbl}>Title (H1) {isOrig ? '*' : ''}</label>
          <input className={input + ' text-base font-bold'} dir={LANGS[tab].rtl ? 'rtl' : undefined} value={cur.title} placeholder="e.g. Baalon Ka Girna Kaise Rokein?" onChange={(e) => setTr(tab, { title: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Short summary for Google (meta description) <span className={descLen > 160 ? 'text-red-600' : 'text-slate-400'}>{descLen}/160</span></label>
          <textarea className={input} rows={2} dir={LANGS[tab].rtl ? 'rtl' : undefined} value={cur.description} onChange={(e) => setTr(tab, { description: e.target.value })} placeholder="1-2 sentences with the words people search on Google." />
        </div>
        {isOrig && (
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
        )}
        <div dir={LANGS[tab].rtl ? 'rtl' : undefined}>
          <label className={lbl}>Text</label>
          <RichTextEditor key={tab} article value={cur.body} onChange={(h) => setTr(tab, { body: h })} onUploadImage={uploadBlogImage} placeholder="Write the article…" />
          <p className="text-[11px] text-slate-500 mt-1" dir="ltr">
            Tips: use <b>H2</b> for each section heading. <b>🖼 Picture</b> adds a picture where the cursor is. <b>🛍 Products</b> adds a box with your shop's products.
            Type <b>[[ad]]</b> on its own line where you want a Google ad inside the article.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-full rounded-xl border bg-slate-50 p-3 space-y-2">
            <p className="text-xs font-bold text-slate-700">When should readers see it?</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={pubMode === 'now'} onChange={() => { setPubMode('now'); setEdit({ ...edit, published: true }); }} /> Publish now</label>
            <label className="flex flex-wrap items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={pubMode === 'schedule'} onChange={() => { setPubMode('schedule'); setEdit({ ...edit, published: true }); if (!pubAt) setPubAt(toLocalInput(new Date(Date.now() + 86400000).toISOString())); }} /> Publish automatically on
              <input type="datetime-local" className={input + ' w-auto'} value={pubAt} onChange={(e) => { setPubAt(e.target.value); setPubMode('schedule'); setEdit({ ...edit, published: true }); }} />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={pubMode === 'draft'} onChange={() => { setPubMode('draft'); setEdit({ ...edit, published: false }); }} /> Draft (hidden, not published)</label>
          </div>
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

  const row = (p: Post) => {
    const st = stats[p.id];
    const tl = postLangs(p);
    return (
      <div key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 border-b last:border-0">
        {p.kind === 'blog' && (p.cover_url ? <img src={p.cover_url} alt="" className="w-14 h-10 rounded object-cover" /> : <div className="w-14 h-10 rounded bg-amber-100" />)}
        <div className="flex-1 min-w-[12rem]">
          <p className="font-semibold text-slate-800">{p.title}{' '}
            {!p.published ? <span className="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5 py-0.5 ml-1">DRAFT</span>
              : !isLive(p) ? <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 ml-1">SCHEDULED · {new Date(p.publish_at as string).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              : <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 ml-1">LIVE</span>}
          </p>
          <a href={postPath(p)} target="_blank" rel="noreferrer" className="text-xs text-amber-700 underline">sktraderpk.com{postPath(p)}</a>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {tl.map((k) => LANGS[k].name).join(' · ')}
            {st && <> · 👁 {st.views_all} views · ♥ {st.likes} · 💬 {st.comments}{st.pending ? <b className="text-amber-700"> ({st.pending} waiting)</b> : null}</>}
          </p>
        </div>
        <button onClick={() => { setTab(origLang(p)); openEdit({ ...p, translations: { _orig: origLang(p), ...(p.translations || {}) } }); }} className="px-3 py-1.5 rounded-lg border text-sm font-semibold cursor-pointer">Edit</button>
        {!isLive(p) && <button onClick={() => publishNow(p)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">Publish now</button>}
        <button onClick={() => remove(p)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold cursor-pointer">Delete</button>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {msg && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">{msg}</div>}
      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
          <h3 className="text-lg font-extrabold text-slate-900">Blog articles ({blog.length}) <a href="/blog" target="_blank" rel="noreferrer" className="ml-2 text-xs font-bold text-amber-700 underline">Open blog ↗</a></h3>
          <button onClick={() => { setTab('roman'); openEdit(emptyPost('blog')); }} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold cursor-pointer">+ New article</button>
        </div>
        {posts === null ? <p className="text-slate-400 text-sm">Loading…</p> : blog.length ? blog.map(row) : <p className="text-sm text-slate-400">No articles yet.</p>}
        <p className="text-[11px] text-slate-500 mt-3">Write 1-2 articles every week about problems people search on Google (hair fall, dandruff, hair colour, skin care). Each article brings visitors and shows your products.</p>
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <p className="text-sm font-bold text-violet-900">⏰ Auto publish: one article per day</p>
          <p className="text-[11px] text-violet-800 mb-2">All articles that are not live yet (drafts and scheduled) get one day each. They appear on the website by themselves at that time - nothing else to do.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs">Start <input type="date" className={input + ' w-auto'} value={autoStart} onChange={(e) => setAutoStart(e.target.value)} /></label>
            <label className="text-xs">Time <input type="time" className={input + ' w-auto'} value={autoTime} onChange={(e) => setAutoTime(e.target.value)} /></label>
            <button onClick={autoSchedule} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold cursor-pointer">Schedule</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <h3 className="text-lg font-extrabold text-slate-900 border-b pb-2 mb-2">Comments {pendingCount > 0 && <span className="ml-1 text-xs font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{pendingCount} waiting</span>}</h3>
        {comments === null ? <p className="text-sm text-slate-400">Run supabase_v23.sql once to switch on likes and comments.</p>
          : comments.length === 0 ? <p className="text-sm text-slate-400">No comments yet.</p>
          : <div className="divide-y max-h-[28rem] overflow-y-auto">{comments.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-wrap gap-2 items-start">
              <div className="flex-1 min-w-[14rem]">
                <p className="text-sm"><b>{c.name}</b> on <a href={`/blog/${c.post_slug}`} target="_blank" rel="noreferrer" className="text-amber-700 underline">{c.post_title}</a> <span className="text-[11px] text-slate-400">{fmtDate(c.created_at)}</span></p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{c.body}</p>
              </div>
              {c.approved
                ? <button onClick={() => commentSet(c, false)} className="px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer">Hide</button>
                : <button onClick={() => commentSet(c, true)} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">Approve</button>}
              <button onClick={() => commentSet(c, null)} className="px-3 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold cursor-pointer">Delete</button>
            </div>
          ))}</div>}
        <p className="text-[11px] text-slate-500 mt-2">New comments show on the website only after you press Approve (protects the blog from spam - Google AdSense does not like spam).</p>
      </div>

      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
          <h3 className="text-lg font-extrabold text-slate-900">Pages ({pages.length})</h3>
          <button onClick={() => { setTab('en'); openEdit(emptyPost('page')); }} className="px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer">+ New page</button>
        </div>
        {posts === null ? <p className="text-slate-400 text-sm">Loading…</p> : pages.map(row)}
        <p className="text-[11px] text-slate-500 mt-3">All published pages are linked in the website footer automatically.</p>
      </div>

      <div className="bg-white rounded-3xl p-5 border shadow-sm space-y-3">
        <h3 className="text-lg font-extrabold text-slate-900 border-b pb-2">Google AdSense</h3>
        <ol className="text-xs text-slate-600 list-decimal pl-5 space-y-1">
          <li>Open <b>adsense.google.com</b>, sign in with your Gmail and add the site <b>sktraderpk.com</b>.</li>
          <li>Find your <b>Publisher ID</b>: AdSense → <b>Account → Settings → Account information</b>. It looks like <b>pub-1234567890123456</b> (16 digits).</li>
          <li>Paste it below and press Save. The AdSense code and <b>sktraderpk.com/ads.txt</b> are added automatically - then press "Request review" in AdSense.</li>
          <li>After approval: in AdSense turn on <b>Auto ads</b>, or create a <b>Display ad unit</b> and paste its <b>data-ad-slot</b> number below for ads inside articles.</li>
        </ol>
        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <label className={lbl}>Publisher ID</label>
            <input className={input} placeholder="pub-1234567890123456" value={ads.adsense_client} onChange={(e) => setAds({ ...ads, adsense_client: e.target.value.trim() })} />
          </div>
          <div>
            <label className={lbl}>Ad unit ID for articles (optional, after approval)</label>
            <input className={input} placeholder="e.g. 1234567890" value={ads.adsense_slot} onChange={(e) => setAds({ ...ads, adsense_slot: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
        <div>
          <label className={lbl}>Where can ads appear?</label>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" className="mt-1" checked={ads.ads_place !== 'all'} onChange={() => setAds({ ...ads, ads_place: 'blog' })} /> <span><b>Only on the blog and info pages (recommended)</b> - the shop, product pages and checkout stay clean so customers are not sent away to other websites.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer mt-1"><input type="radio" className="mt-1" checked={ads.ads_place === 'all'} onChange={() => setAds({ ...ads, ads_place: 'all' })} /> <span>Everywhere (also the shop pages)</span></label>
        </div>
        <button onClick={async () => {
          const v = ads.adsense_client.trim().toLowerCase();
          const m = v.match(/^(?:ca-)?pub-(\d{10,20})$/);
          if (v && !m) { setMsg('The Publisher ID must look like pub-1234567890123456'); return; }
          const ok = await onSaveAds({ adsense_client: m ? `ca-pub-${m[1]}` : '', ads_place: ads.ads_place === 'all' ? 'all' : 'blog', adsense_slot: ads.adsense_slot });
          setMsg(ok ? 'AdSense settings saved.' : 'Could not save (run supabase_v22.sql and supabase_v23.sql once).');
        }} className="px-5 py-2.5 rounded-xl bg-slate-900 text-amber-400 text-sm font-bold cursor-pointer">Save AdSense settings</button>
      </div>
    </div>
  );
}
