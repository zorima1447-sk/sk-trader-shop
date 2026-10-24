import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Deals (bundles): several products sold together for one special price.
// Admin > Deals: make / edit / delete a deal, pick its items from the shop's
// products, the "current rate" is worked out from the items' own prices.
// The database (place_order) charges the deal price and lowers the stock of
// every item in the deal.
// ---------------------------------------------------------------------------

export interface DealItem {
  product_id: string;
  variant?: string | null; // size / shade, when the product has them
  qty: number;
}

export interface Deal {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  items: DealItem[];
  deal_price: number;
  is_active: boolean;
  starts_at?: string | null; // deal shows from this time (empty = at once)
  ends_at?: string | null;   // deal disappears by itself after this time (empty = no end)
  sort_order?: number;
  created_at?: string;
}

// the parts of a product this file needs
export interface DealProduct {
  id: string;
  name: string;
  price: number;
  discounted_price: number;
  image_url: string;
  stock_quantity: number;
  variants?: { name: string; price: number; stock: number; image?: string }[] | null;
}

const money = (n: number) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');

const variantOf = (p: DealProduct | undefined, name?: string | null) =>
  p && name && Array.isArray(p.variants) ? p.variants.find((v) => v && v.name === name) : undefined;

// price of one item (size price when a size is chosen)
export function itemUnitPrice(p: DealProduct | undefined, variant?: string | null): number {
  if (!p) return 0;
  const v = variantOf(p, variant);
  if (v) return Number(v.price) || 0;
  return Number(p.discounted_price || p.price) || 0;
}

// "current rate" = what the items would cost one by one
export function dealCurrentRate(d: Pick<Deal, 'items'>, products: DealProduct[]): number {
  return (d.items || []).reduce((s, it) => s + itemUnitPrice(products.find((p) => p.id === it.product_id), it.variant) * (Number(it.qty) || 1), 0);
}

// how many deals can still be sold (limited by the item with the least stock)
export function dealStock(d: Pick<Deal, 'items'>, products: DealProduct[]): number {
  if (!d.items || d.items.length === 0) return 0;
  let n = Infinity;
  for (const it of d.items) {
    const p = products.find((x) => x.id === it.product_id);
    if (!p) return 0;
    const v = variantOf(p, it.variant);
    const stock = v ? Number(v.stock) || 0 : Number(p.stock_quantity) || 0;
    n = Math.min(n, Math.floor(stock / Math.max(1, Number(it.qty) || 1)));
  }
  return n === Infinity ? 0 : n;
}

export function dealItemNames(d: Pick<Deal, 'items'>, products: DealProduct[]): string[] {
  return (d.items || []).map((it) => {
    const p = products.find((x) => x.id === it.product_id);
    const name = p ? p.name + (it.variant ? ` - ${it.variant}` : '') : 'Removed product';
    return (Number(it.qty) > 1 ? `${it.qty} x ` : '') + name;
  });
}

// running now? (switched on, started, not yet ended)
export function dealLive(d: Pick<Deal, 'is_active' | 'starts_at' | 'ends_at'>, now = Date.now()): boolean {
  if (!d.is_active) return false;
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return false;
  if (d.ends_at && new Date(d.ends_at).getTime() <= now) return false;
  return true;
}

// "2d 5h left", "3h 20m left", "15m left"
export function timeLeft(end: string, now = Date.now()): string {
  const ms = new Date(end).getTime() - now;
  if (ms <= 0) return 'Ended';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${mm}m left`;
  return `${Math.max(1, mm)}m left`;
}

// datetime-local input <-> database time
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const niceDate = (iso: string) => new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const dealSavePct = (cur: number, price: number) => (cur > price && cur > 0 ? Math.round(((cur - price) / cur) * 100) : 0);

export async function fetchDeals(all = false): Promise<Deal[]> {
  let q = supabase.from('deals').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (!all) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) { console.warn('deals fetch', error.message); return []; }
  return (data || []).map((d: any) => ({ ...d, items: Array.isArray(d.items) ? d.items : [], deal_price: Number(d.deal_price) || 0 }));
}

// ----------------------------- shop page -----------------------------
export function DealsSection({ deals, products, title, onAdd, onBuy }: {
  deals: Deal[];
  products: DealProduct[];
  title: string;
  onAdd: (d: Deal) => void;
  onBuy: (d: Deal) => void;
}) {
  // tick every 30 s so a finished deal leaves the page by itself and the time left stays right
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const list = deals.filter((d) => dealLive(d, now) && d.items.length > 0);
  if (list.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 mt-6 sm:mt-8">
      <h2 className="text-center text-lg sm:text-2xl font-extrabold text-slate-800 tracking-wide">{title || 'Special Deals'}</h2>
      <div className="mx-auto mt-1.5 mb-4 h-1 w-14 rounded-full bg-amber-500" />
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {list.map((d) => {
          const cur = dealCurrentRate(d, products);
          const pct = dealSavePct(cur, d.deal_price);
          const left = dealStock(d, products);
          const pic = d.image_url || (products.find((p) => p.id === d.items[0]?.product_id) || ({} as any)).image_url || '';
          return (
            <div key={d.id} className="group w-[47%] max-w-[18rem] sm:w-64 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-amber-300 transition duration-300 overflow-hidden flex flex-col">
              <div className="aspect-square bg-white relative overflow-hidden border-b border-slate-100">
                {pic && <img src={pic} alt={d.name} className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500" />}
                <span className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">DEAL</span>
                {pct > 0 && <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">Save {pct}%</span>}
                {d.ends_at && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/85 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                    ⏱ {timeLeft(d.ends_at, now)}
                  </span>
                )}
              </div>
              <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{d.name}</h3>
                <ul className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                  {dealItemNames(d, products).slice(0, 4).map((n, i) => <li key={i} className="truncate">• {n}</li>)}
                  {d.items.length > 4 && <li>+ {d.items.length - 4} more</li>}
                </ul>
                <div className="mt-2">
                  <span className="text-amber-600 font-black text-base sm:text-lg">{money(d.deal_price)}</span>
                  {cur > d.deal_price && <span className="ml-1.5 text-[11px] text-slate-400 line-through">{money(cur)}</span>}
                </div>
                {left <= 0
                  ? <p className="text-[10px] text-red-600 font-semibold">Out of stock</p>
                  : left <= 5 ? <p className="text-[10px] text-red-600 font-semibold">Only {left} left</p> : null}
                <div className="mt-auto pt-2 grid grid-cols-2 gap-1.5">
                  <button onClick={() => onAdd(d)} disabled={left <= 0} className="border border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold py-1.5 rounded-full transition cursor-pointer">Add to Cart</button>
                  <button onClick={() => onBuy(d)} disabled={left <= 0} className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold py-1.5 rounded-full transition cursor-pointer">Buy Now</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ----------------------------- admin -----------------------------
const input = 'w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500';
const label = 'block text-xs font-bold text-slate-700 mb-1';

async function uploadDealImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not an image.'));
      img.onload = () => {
        const scale = Math.min(1, 900 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); }
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `slide-deal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.warn('Deal image upload failed, keeping the embedded image', err);
    return dataUrl;
  }
}

const emptyDeal = (): Omit<Deal, 'id'> => ({ name: '', description: '', image_url: '', items: [], deal_price: 0, is_active: true, starts_at: null, ends_at: null, sort_order: 0 });

export function DealsAdmin({ products, deals, onChanged, title, onTitle }: {
  products: DealProduct[];
  deals: Deal[];
  onChanged: () => void;
  title: string;
  onTitle?: (t: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Deal, 'id'>>(emptyDeal());
  const [find, setFind] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState(false);

  const cur = dealCurrentRate(form, products);
  const pct = dealSavePct(cur, form.deal_price);
  const hits = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return browse ? products.slice(0, 300) : ([] as DealProduct[]);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 40);
  }, [find, products, browse]);

  const startNew = () => { setEditId(null); setForm(emptyDeal()); setFind(''); setOpen(true); };
  const startEdit = (d: Deal) => {
    setEditId(d.id);
    setForm({ name: d.name, description: d.description || '', image_url: d.image_url || '', items: d.items.map((i) => ({ ...i })), deal_price: d.deal_price, is_active: d.is_active, starts_at: d.starts_at || null, ends_at: d.ends_at || null, sort_order: d.sort_order || 0 });
    setFind('');
    setOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addItem = (p: DealProduct) => {
    const firstV = Array.isArray(p.variants) && p.variants.length ? p.variants[0].name : null;
    setForm((f) => {
      const same = f.items.findIndex((i) => i.product_id === p.id && (i.variant || null) === firstV);
      if (same >= 0) return { ...f, items: f.items.map((i, k) => (k === same ? { ...i, qty: i.qty + 1 } : i)) };
      return { ...f, items: [...f.items, { product_id: p.id, variant: firstV, qty: 1 }] };
    });
    setFind('');
  };
  const setItem = (k: number, patch: Partial<DealItem>) => setForm((f) => ({ ...f, items: f.items.map((i, x) => (x === k ? { ...i, ...patch } : i)) }));
  const removeItem = (k: number) => setForm((f) => ({ ...f, items: f.items.filter((_, x) => x !== k) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('Please write a name for the deal.'); return; }
    if (form.items.length === 0) { alert('Please add at least one item to the deal.'); return; }
    if (!(form.deal_price > 0)) { alert('Please write the deal price.'); return; }
    if (form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at)) { alert('The end date must be after the start date.'); return; }
    if (form.ends_at && new Date(form.ends_at).getTime() <= Date.now() && !window.confirm('The end date is already over, so the deal will not show on the website. Save anyway?')) return;
    setBusy(true);
    const row = {
      name: form.name.trim(),
      description: (form.description || '').trim() || null,
      image_url: form.image_url || null,
      items: form.items.map((i) => ({ product_id: i.product_id, variant: i.variant || null, qty: Math.max(1, Number(i.qty) || 1) })),
      deal_price: Number(form.deal_price),
      is_active: form.is_active,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      sort_order: Number(form.sort_order) || 0
    };
    const { error } = editId
      ? await supabase.from('deals').update(row).eq('id', editId)
      : await supabase.from('deals').insert([row]);
    setBusy(false);
    if (error) {
      alert('Could not save the deal:\n' + error.message + (/deals/i.test(error.message) ? '\n\nRun the latest supabase_setup.sql in Supabase > SQL Editor.' : ''));
      return;
    }
    setOpen(false);
    setEditId(null);
    setForm(emptyDeal());
    onChanged();
    alert('Deal saved!');
  };

  const remove = async (d: Deal) => {
    if (!window.confirm(`Delete the deal "${d.name}"? (Products and old orders are not affected.)`)) return;
    const { error } = await supabase.from('deals').delete().eq('id', d.id);
    if (error) { alert('Could not delete:\n' + error.message); return; }
    if (editId === d.id) { setOpen(false); setEditId(null); }
    onChanged();
  };

  const toggle = async (d: Deal) => {
    const { error } = await supabase.from('deals').update({ is_active: !d.is_active }).eq('id', d.id);
    if (error) { alert(error.message); return; }
    onChanged();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={startNew} className="bg-slate-900 text-amber-400 font-bold text-sm px-4 py-2.5 rounded-xl cursor-pointer">+ New Deal</button>
        {onTitle && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            Heading on the shop:
            <input className={input + ' w-48'} value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Special Deals" />
          </label>
        )}
      </div>

      {open && (
        <form onSubmit={save} className="bg-white rounded-3xl p-5 border shadow-sm space-y-4">
          <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b">{editId ? 'Edit Deal' : 'New Deal'}</h3>

          <div className="grid md:grid-cols-[10rem_1fr] gap-4">
            <div>
              <label className={label}>Deal picture</label>
              <div className="w-40 h-40 border rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-[10px] text-slate-400 text-center px-2">No picture (the first item's picture is used)</span>}
              </div>
              <input
                type="file"
                accept="image/*"
                className="text-[11px] mt-2 w-40"
                onChange={async (e) => {
                  const fl = e.target.files && e.target.files[0];
                  e.target.value = '';
                  if (!fl) return;
                  setBusy(true);
                  try { const url = await uploadDealImage(fl); setForm((f) => ({ ...f, image_url: url })); }
                  catch (err: any) { alert(err.message || String(err)); }
                  finally { setBusy(false); }
                }}
              />
              {form.image_url && <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: '' }))} className="block text-[11px] text-red-600 font-bold mt-1 cursor-pointer">Remove picture</button>}
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>Deal name *</label>
                <input className={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Hair Care Combo" />
              </div>
              <div>
                <label className={label}>Short description (optional)</label>
                <input className={input} value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Shampoo + Mask + Serum" />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Show this deal on the website
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Deal starts (optional)</label>
                  <input type="datetime-local" className={input} value={toLocalInput(form.starts_at)} onChange={(e) => setForm((f) => ({ ...f, starts_at: fromLocalInput(e.target.value) }))} />
                  <p className="text-[10px] text-slate-400 mt-0.5">Empty = starts at once</p>
                </div>
                <div>
                  <label className={label}>Deal ends (date &amp; time)</label>
                  <input type="datetime-local" className={input} value={toLocalInput(form.ends_at)} onChange={(e) => setForm((f) => ({ ...f, ends_at: fromLocalInput(e.target.value) }))} />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[1, 3, 7, 15, 30].map((n) => (
                      <button key={n} type="button" onClick={() => { const t = new Date(); t.setDate(t.getDate() + n); t.setHours(23, 59, 0, 0); setForm((f) => ({ ...f, ends_at: t.toISOString() })); }} className="text-[10px] font-bold border rounded-full px-2 py-0.5 cursor-pointer hover:border-amber-500">{n} day{n > 1 ? 's' : ''}</button>
                    ))}
                    {form.ends_at && <button type="button" onClick={() => setForm((f) => ({ ...f, ends_at: null }))} className="text-[10px] text-slate-500 underline cursor-pointer">No end date</button>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">On this date the deal leaves the website by itself.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">Items in this deal</p>
            <div className="relative">
              <div className="flex gap-2">
                <input className={input} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a product name to add it..." />
                <button type="button" onClick={() => { setBrowse((b) => !b); setFind(''); }} className={`shrink-0 px-3 rounded-xl border text-xs font-bold cursor-pointer ${browse ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                  {browse ? 'Close list' : 'All products'}
                </button>
              </div>
              {hits.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  {hits.map((p) => (
                    <button key={p.id} type="button" onClick={() => { addItem(p); setBrowse(false); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50 text-left cursor-pointer">
                      <img src={p.image_url} alt="" className="w-9 h-9 object-contain rounded bg-white border shrink-0" />
                      <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                      <span className="text-xs font-bold text-amber-600 shrink-0">{money(itemUnitPrice(p))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.items.length === 0 && <p className="text-xs text-slate-400">No items yet. Search above and tap a product to add it.</p>}
            {form.items.map((it, k) => {
              const p = products.find((x) => x.id === it.product_id);
              const vs = p && Array.isArray(p.variants) ? p.variants.filter((v) => v && v.name) : [];
              const unit = itemUnitPrice(p, it.variant);
              return (
                <div key={k} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white border rounded-xl p-2">
                  <img src={(p && (variantOf(p, it.variant)?.image || p.image_url)) || ''} alt="" className="w-10 h-10 object-contain rounded border bg-white shrink-0" />
                  <span className="flex-1 min-w-[8rem] text-sm font-semibold text-slate-800 truncate">{p ? p.name : 'Removed product'}</span>
                  {vs.length > 0 && (
                    <select value={it.variant || ''} onChange={(e) => setItem(k, { variant: e.target.value })} className="px-2 py-1.5 border rounded-lg text-xs bg-white max-w-[10rem]">
                      {vs.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                  )}
                  <span className="flex items-center gap-1 text-xs">
                    Qty
                    <input type="number" min={1} value={it.qty} onChange={(e) => setItem(k, { qty: Math.max(1, Number(e.target.value) || 1) })} className="w-16 px-2 py-1.5 border rounded-lg text-xs" />
                  </span>
                  <span className="text-xs text-slate-600 w-24 text-right">{money(unit * it.qty)}</span>
                  <button type="button" onClick={() => removeItem(k)} className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold cursor-pointer">Remove</button>
                </div>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className={label}>Current rate (items one by one)</label>
              <div className="px-3 py-2 border rounded-xl text-sm bg-slate-100 font-bold text-slate-700">{money(cur)}</div>
            </div>
            <div>
              <label className={label}>Deal rate (Rs.) *</label>
              <input className={input} inputMode="numeric" value={form.deal_price ? String(form.deal_price) : ''} onChange={(e) => setForm((f) => ({ ...f, deal_price: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))} placeholder="e.g. 4999" />
            </div>
            <div className="text-sm">
              {form.deal_price > 0 && cur > 0 && (
                pct > 0
                  ? <span className="text-emerald-700 font-bold">Customer saves {money(cur - form.deal_price)} ({pct}%)</span>
                  : <span className="text-red-600 font-bold">The deal rate is not lower than the current rate</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50 cursor-pointer">{busy ? 'Please wait...' : editId ? 'Save changes' : 'Save deal'}</button>
            <button type="button" onClick={() => { setOpen(false); setEditId(null); }} className="border font-bold text-sm px-5 py-2.5 rounded-xl cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-3xl p-5 border shadow-sm">
        <h3 className="text-lg font-extrabold text-slate-900 pb-2 border-b mb-3">All deals ({deals.length})</h3>
        {deals.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No deals yet. Press "+ New Deal".</p>}
        <div className="space-y-2">
          {deals.map((d) => {
            const c = dealCurrentRate(d, products);
            const pic = d.image_url || (products.find((p) => p.id === d.items[0]?.product_id) || ({} as any)).image_url || '';
            return (
              <div key={d.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 border rounded-2xl p-3">
                <img src={pic} alt="" className="w-14 h-14 object-contain rounded-lg border bg-white shrink-0" />
                <div className="flex-1 min-w-[10rem]">
                  <p className="font-bold text-slate-900 text-sm">
                    {d.name}{' '}
                    {!d.is_active
                      ? <span className="ml-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Hidden</span>
                      : d.ends_at && new Date(d.ends_at).getTime() <= Date.now()
                        ? <span className="ml-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Ended</span>
                        : d.starts_at && new Date(d.starts_at).getTime() > Date.now()
                          ? <span className="ml-1 text-[10px] font-bold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Starts {niceDate(d.starts_at)}</span>
                          : <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Live</span>}
                  </p>
                  {d.ends_at && <p className="text-[11px] text-slate-500">Ends: {niceDate(d.ends_at)}{new Date(d.ends_at).getTime() > Date.now() ? ` (${timeLeft(d.ends_at)})` : ''}</p>}
                  <p className="text-[11px] text-slate-500 truncate">{dealItemNames(d, products).join(', ')}</p>
                  <p className="text-xs mt-0.5">
                    <span className="font-black text-amber-600">{money(d.deal_price)}</span>
                    {c > d.deal_price && <span className="ml-1.5 text-slate-400 line-through">{money(c)}</span>}
                    <span className="ml-2 text-slate-500">Stock: {dealStock(d, products)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => toggle(d)} className="px-3 py-1.5 border rounded-lg text-xs font-bold cursor-pointer">{d.is_active ? 'Hide' : 'Show'}</button>
                <button type="button" onClick={() => startEdit(d)} className="px-3 py-1.5 border rounded-lg text-xs font-bold text-amber-700 cursor-pointer">Edit</button>
                <button type="button" onClick={() => remove(d)} className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold cursor-pointer">Delete</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
