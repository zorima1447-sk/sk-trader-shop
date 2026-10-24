import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { StoreSettings, ACCENTS, THEMES, accentSwatch, FontDef, MarqueeItem, Brand, FONTS, FONT_SIZES, googleFontUrl, deliveryChargeFor } from './storeSettings';
import { ICONS, ShopIcon } from './icons';
import { BrandLogo } from './BrandLogo';
import { PROVINCES } from './pakistan';
import { InvoiceDocument } from './Invoice';

export type SettingsTab = 'profile' | 'look' | 'invoice' | 'messages' | 'delivery' | 'brands' | 'content';

interface Props {
  tab?: SettingsTab; // chosen from the admin side menu
  settings: StoreSettings;
  accounts: any[];
  onSaved: (s: StoreSettings) => void;
  onOpenAccounts: () => void;
}

type SubTab = SettingsTab;

const input = 'w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500';
const label = 'block text-xs font-bold text-slate-700 mb-1';

export default function SettingsPanel({ tab: fixedTab, settings, accounts, onSaved, onOpenAccounts }: Props) {
  const [f, setF] = useState<StoreSettings>(settings);
  const [ownTab, setTab] = useState<SubTab>('profile');
  const tab = fixedTab || ownTab;
  const [busy, setBusy] = useState(false);

  useEffect(() => { setF(settings); }, [settings]);

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const scale = Math.min(1, 500 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/png');
        setBusy(true);
        try {
          const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('Could not process the image.');
          const path = `logo-${Date.now()}.png`;
          const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/png', upsert: false });
          if (error) throw error;
          const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
          set('logo_url', data.publicUrl);
        } catch (err: any) {
          console.warn('Logo upload to storage failed, using embedded image', err);
          set('logo_url', dataUrl);
          alert('The logo was added, but it could not be uploaded to Supabase Storage (' + (err.message || err) + '). It will show on the website, but not inside emails. Run supabase_setup.sql again to create the storage bucket.');
        } finally {
          setBusy(false);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('store_settings').upsert({ id: 1, ...f, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      alert('Database error (settings save):\n' + error.message + (/column/i.test(error.message) ? '\n\nRun the latest supabase_setup.sql in Supabase > SQL Editor, then save again.' : ''));
      return;
    }
    onSaved(f);
    alert('Settings saved successfully!');
  };

  // ---- scrolling strip editor ----
  const items: MarqueeItem[] = f.marquee_items || [];
  const setItem = (i: number, patch: Partial<MarqueeItem>) =>
    set('marquee_items', items.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set('marquee_items', next);
  };

  // ---- Our Brands editor ----
  const brands: Brand[] = f.brands || [];
  const setBrand = (i: number, patch: Partial<Brand>) =>
    set('brands', brands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const moveBrand = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= brands.length) return;
    const next = [...brands];
    [next[i], next[j]] = [next[j], next[i]];
    set('brands', next);
  };
  const uploadBrandLogo = (i: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const scale = Math.min(1, 400 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBusy(true);
        try {
          const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('Could not process the image.');
          const path = `logo-brand-${Date.now()}.png`;
          const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/png', upsert: false });
          if (error) throw error;
          setBrand(i, { logo_url: supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl });
        } catch (err: any) {
          setBrand(i, { logo_url: canvas.toDataURL('image/png') });
          console.warn('Brand logo upload failed, using embedded image', err);
        } finally {
          setBusy(false);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // small square picture (Deals icon) -> Supabase Storage
  const uploadIcon = (file: File, done: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 240, 240);
        setBusy(true);
        try {
          const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('Could not process the image.');
          const path = `logo-deal-icon-${Date.now()}.png`;
          const { error } = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/png', upsert: false });
          if (error) throw error;
          done(supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl);
        } catch {
          done(canvas.toDataURL('image/png'));
        } finally {
          setBusy(false);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // load every font once so the admin can see them before choosing
  useEffect(() => {
    if (tab !== 'profile' || document.getElementById('font-previews')) return;
    const link = document.createElement('link');
    link.id = 'font-previews';
    link.rel = 'stylesheet';
    link.href = googleFontUrl(FONTS.filter((x) => x.google));
    document.head.appendChild(link);
  }, [tab]);

  // font cards grouped by style
  const fontGrid = (list: FontDef[], current: string, pick: (k: string) => void, sample: string, big = false) => {
    const groups = Array.from(new Set(list.map((x) => x.group)));
    return (
      <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{g}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.filter((x) => x.group === g).map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => pick(x.key)}
                  className={`text-left px-3 py-2.5 rounded-xl border bg-white cursor-pointer ${current === x.key ? 'border-slate-900 ring-2 ring-amber-400' : 'border-slate-200 hover:border-slate-400'}`}
                >
                  <span className={`block ${big ? 'text-xl' : 'text-base'} text-slate-900 truncate`} style={{ fontFamily: x.family }}>{sample}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{x.label}{current === x.key ? '  ✓' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---- Home Page Content: trust badges and footer links ----
  const trust = f.trust_items || [];
  const setTrust = (i: number, patch: any) => set('trust_items', trust.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const moveIn = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  const links = f.footer_links || [];
  const setLink = (i: number, patch: any) => set('footer_links', links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const smallBtn = 'px-2.5 py-1.5 border rounded-lg text-xs cursor-pointer bg-white';

  // one "any colour" row: colour picker + code + reset
  const colorRow = (k: 'header_color' | 'page_bg_color' | 'strip_color' | 'strip_text_color' | 'topbar_color' | 'topbar_text_color' | 'footer_color', text: string, fallback: string) => (
    <div className="flex flex-wrap items-center gap-2 bg-white border rounded-xl p-2">
      <span className="text-xs font-bold text-slate-700 w-44">{text}</span>
      <input
        type="color"
        value={f[k] || fallback}
        onChange={(e) => set(k, e.target.value)}
        className="w-11 h-8 p-0 border rounded-lg cursor-pointer"
        aria-label={text}
      />
      <input
        key={f[k]}
        className={input + ' max-w-[7rem] font-mono text-xs'}
        defaultValue={f[k]}
        placeholder="automatic"
        onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) set(k, v.toLowerCase()); }}
        aria-label={text + ' code'}
      />
      {f[k]
        ? <button type="button" onClick={() => set(k, '')} className="text-[11px] text-slate-500 underline cursor-pointer">Reset (automatic)</button>
        : <span className="text-[11px] text-slate-400">automatic</span>}
    </div>
  );

  const toggleAccount = (id: string) => {
    const cur = f.invoice_account_ids || [];
    set('invoice_account_ids', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const tabBtn = (key: SubTab, text: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer ${tab === key ? 'bg-slate-900 text-amber-400' : 'bg-slate-100 text-slate-600'}`}
    >
      {text}
    </button>
  );

  const check = (k: keyof StoreSettings, text: string) => (
    <label className="flex items-center space-x-2 text-sm font-bold text-slate-700 cursor-pointer">
      <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked as any)} />
      <span>{text}</span>
    </label>
  );

  const sampleOrder = {
    invoice_no: 'ZP-1001',
    created_at: new Date().toISOString(),
    customer_name: 'Sample Customer',
    customer_phone: '+923001234567',
    customer_email: 'customer@example.com',
    shipping_address: 'Shop 5, Main Market, Lahore, Punjab, Pakistan',
    total_amount: 4500,
    paid_amount: 0,
    payment_method: 'cod'
  };
  const sampleItems = [
    { product_name: 'Sample Shampoo 500ml', quantity: 2, unit_price: 1500 },
    { product_name: 'Sample Hair Mask 250g', quantity: 1, unit_price: 1500 }
  ];

  return (
    <form onSubmit={save} className="bg-white rounded-3xl p-6 border shadow-sm">
      <h3 className="text-lg font-extrabold text-slate-900 mb-4 pb-2 border-b">
        {{ profile: 'Store Profile', look: 'Website Look & Theme', invoice: 'Invoice', messages: 'Customer Messages', delivery: 'Delivery Charges', brands: 'Our Brands', content: 'Home Page Content' }[tab]}
      </h3>

      {!fixedTab && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tabBtn('profile', 'Store Profile')}
          {tabBtn('look', 'Website Look')}
          {tabBtn('invoice', 'Invoice')}
          {tabBtn('messages', 'Customer Messages')}
        </div>
      )}

      {tab === 'profile' && (
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
          <div className="md:col-span-2">
            <label className={label}>Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 border rounded-xl flex items-center justify-center bg-slate-50 overflow-hidden">
                {f.logo_url ? <img src={f.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-slate-400">No logo</span>}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handleLogo} className="text-xs" />
                {f.logo_url && (
                  <button type="button" onClick={() => set('logo_url', '')} className="block text-[11px] text-red-600 font-bold mt-1 cursor-pointer">Remove logo</button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className={label}>Store / company name *</label>
            <input className={input} required value={f.store_name} onChange={(e) => set('store_name', e.target.value)} />
          </div>
          <div>
            <label className={label}>Header subtitle</label>
            <input className={input} value={f.header_subtitle} onChange={(e) => set('header_subtitle', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Tagline (shown in the footer)</label>
            <input className={input} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </div>
          <div>
            <label className={label}>Contact phone</label>
            <input className={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+92 300 1234567" />
          </div>
          <div>
            <label className={label}>Contact email</label>
            <input type="email" className={input} value={f.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={label}>WhatsApp number (country code, digits only)</label>
            <input className={input} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="923001234567" />
          </div>
          <div>
            <label className={label}>Address</label>
            <textarea rows={2} className={input} value={f.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div>
            <label className={label}>Facebook page link</label>
            <input className={input} value={f.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="https://facebook.com/yourpage" />
          </div>
          <div>
            <label className={label}>Instagram link</label>
            <input className={input} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="https://instagram.com/yourpage" />
          </div>
          <div>
            <label className={label}>TikTok link</label>
            <input className={input} value={f.tiktok} onChange={(e) => set('tiktok', e.target.value)} placeholder="https://tiktok.com/@yourpage" />
          </div>

          <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border space-y-4">
            <p className="text-sm font-extrabold text-slate-800">Font & text size (whole website)</p>
            <div>
              <label className={label}>Main font (all text) - {FONTS.filter((x) => !x.display).length} fonts</label>
              {fontGrid(FONTS.filter((x) => !x.display), f.font_family, (k) => set('font_family', k), `${f.store_name || 'Your Store'} - Rs. 1,250`)}
            </div>
            <div>
              <label className={label}>Heading font (shop name and section headings like "Our Brands")</label>
              <button
                type="button"
                onClick={() => set('heading_font', 'same')}
                className={`mb-2 px-3 py-2 rounded-xl border bg-white text-xs font-bold cursor-pointer ${f.heading_font === 'same' ? 'border-slate-900 ring-2 ring-amber-400' : 'border-slate-200'}`}
              >
                Same as main font {f.heading_font === 'same' ? '✓' : ''}
              </button>
              {fontGrid(FONTS.filter((x) => x.key !== 'system'), f.heading_font, (k) => set('heading_font', k), f.store_name || 'Our Brands', true)}
            </div>
            <div>
              <label className={label}>Text size</label>
              <div className="flex flex-wrap gap-2">
                {FONT_SIZES.map((z) => (
                  <button
                    key={z.value}
                    type="button"
                    onClick={() => set('font_scale', z.value)}
                    className={`px-3 py-2 rounded-xl border bg-white cursor-pointer font-bold ${f.font_scale === z.value ? 'border-slate-900 ring-2 ring-amber-400' : 'border-slate-200'}`}
                    style={{ fontSize: `${(z.value / 100) * 13}px` }}
                  >
                    Aa {z.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-slate-500">A</span>
                <input
                  type="range"
                  min={70}
                  max={160}
                  step={5}
                  value={f.font_scale}
                  onChange={(e) => set('font_scale', Number(e.target.value))}
                  className="flex-1 accent-amber-600 cursor-pointer"
                  aria-label="Text size"
                />
                <span className="text-xl font-bold text-slate-700">A</span>
                <span className="w-14 text-right text-sm font-bold text-slate-800">{f.font_scale}%</span>
              </div>
              <p className="mt-2 text-slate-800 border rounded-xl bg-white px-3 py-2" style={{ fontSize: `${(f.font_scale / 100) * 14}px` }}>
                Preview: Keratin Shampoo 1000 ML - <b>Rs. 3,300</b>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Drag the slider (70% - 160%) or press a size. Makes all text, buttons and boxes on the website bigger or smaller. Save to see it on the site.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'delivery' && (
        <div className="space-y-4 max-w-xl">
          <p className="text-xs text-slate-500">
            The customer sees the delivery charge at checkout as soon as he picks his city. It is added to the order total,
            the invoice and the payment amount.
          </p>
          <div className="border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_9rem] bg-slate-50 border-b px-3 py-2 text-[11px] font-bold text-slate-500">
              <span>Where</span><span>Charge (Rs.)</span>
            </div>
            <div className="grid grid-cols-[1fr_9rem] items-center gap-2 px-3 py-2 border-b bg-amber-50/50">
              <span className="text-sm font-semibold text-slate-800">Karachi city <span className="text-[11px] font-normal text-slate-500">(0 = free)</span></span>
              <input className={input} inputMode="numeric" value={String(f.delivery_karachi)} onChange={(e) => set('delivery_karachi', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
            </div>
            {PROVINCES.map((p) => {
              const has = f.delivery_rates && f.delivery_rates[p] !== undefined;
              return (
                <div key={p} className="grid grid-cols-[1fr_9rem] items-center gap-2 px-3 py-2 border-b last:border-b-0">
                  <span className="text-sm text-slate-700">{p}{p === 'Sindh' ? <span className="text-[11px] text-slate-500"> (other than Karachi)</span> : null}</span>
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder={String(f.delivery_other)}
                    value={has ? String(f.delivery_rates[p]) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      const next = { ...(f.delivery_rates || {}) };
                      if (raw === '') delete next[p]; else next[p] = Number(raw);
                      set('delivery_rates', next);
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div>
            <label className={label}>Default charge (used for a province left empty above)</label>
            <input className={input + ' max-w-xs'} inputMode="numeric" value={String(f.delivery_other)} onChange={(e) => set('delivery_other', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
          </div>
          <div>
            <label className={label}>Free delivery for orders of (Rs.) or more - all cities</label>
            <input className={input + ' max-w-xs'} inputMode="numeric" value={String(f.free_delivery_over)} onChange={(e) => set('free_delivery_over', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
            <p className="text-[11px] text-slate-400 mt-1">0 = no free delivery offer</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border">
            {check('cod_karachi_only', 'Cash on Delivery only for Karachi (other cities must pay online)')}
          </div>
          <div className="bg-slate-50 border rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p><b>Example:</b> order of Rs. 3,000</p>
            {[['Sindh', 'Karachi'], ['Sindh', 'Hyderabad'], ['Punjab', 'Lahore'], ['Khyber Pakhtunkhwa', 'Peshawar']].map(([pv, ct]) => {
              const dc = deliveryChargeFor(f, pv, ct, 3000);
              return <p key={ct}>{ct}: delivery {dc > 0 ? `Rs. ${dc}` : 'FREE'}</p>;
            })}
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div className="space-y-5 max-w-3xl">
          <p className="text-[11px] text-slate-500">Change, add or delete the texts and boxes of the home page. Press <b>Save Settings</b> at the bottom when you are done.</p>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">Section headings</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Categories heading</label>
                <input className={input} value={f.categories_title} onChange={(e) => set('categories_title', e.target.value)} placeholder="Shop by Category" />
              </div>
              <div>
                <label className={label}>All products heading</label>
                <input className={input} value={f.products_title} onChange={(e) => set('products_title', e.target.value)} placeholder="Just For You" />
              </div>
              <div>
                <label className={label}>Deals heading</label>
                <input className={input} value={f.deals_title} onChange={(e) => set('deals_title', e.target.value)} placeholder="Special Deals" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Deals icon (the coloured card before the categories)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center overflow-hidden text-2xl">
                    {f.deals_icon_image
                      ? <img src={f.deals_icon_image} alt="" className="w-full h-full object-cover" />
                      : <ShopIcon name={f.deals_icon || 'tag'} className="w-6 h-6" />}
                  </span>
                  <select
                    value={ICONS[f.deals_icon] ? f.deals_icon : (f.deals_icon ? '__emoji' : 'tag')}
                    onChange={(e) => set('deals_icon', e.target.value === '__emoji' ? '🔥' : e.target.value)}
                    className="px-2 py-2 border rounded-lg text-xs bg-white"
                    aria-label="Deals icon"
                  >
                    {Object.entries(ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    <option value="__emoji">Emoji (type it)</option>
                  </select>
                  {!ICONS[f.deals_icon] && f.deals_icon && (
                    <input className={input + ' w-16'} value={f.deals_icon} onChange={(e) => set('deals_icon', e.target.value)} aria-label="Emoji" />
                  )}
                  <label className="px-3 py-2 border rounded-lg text-xs font-bold text-amber-700 bg-white cursor-pointer">
                    {f.deals_icon_image ? 'Change picture' : 'Use a picture'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (fl) uploadIcon(fl, (u) => set('deals_icon_image', u)); }} />
                  </label>
                  {f.deals_icon_image && <button type="button" onClick={() => set('deals_icon_image', '')} className="text-[11px] text-red-600 font-bold cursor-pointer">Remove picture</button>}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">Flash Sale (products with a discount)</p>
            {check('show_flash', 'Show the Flash Sale row')}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Heading</label>
                <input className={input} value={f.flash_title} onChange={(e) => set('flash_title', e.target.value)} placeholder="Flash Sale" />
              </div>
              <div>
                <label className={label}>Small label</label>
                <input className={input} value={f.flash_badge} onChange={(e) => set('flash_badge', e.target.value)} placeholder="On Sale Now" />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">Trust badges (boxes near the bottom)</p>
            {check('show_trust', 'Show the trust badges')}
            {trust.map((t, i) => (
              <div key={i} className="bg-white border rounded-xl p-2 space-y-2">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><ShopIcon name={t.icon} className="w-5 h-5" /></span>
                  <select
                    value={ICONS[t.icon] ? t.icon : (t.icon ? '__emoji' : '')}
                    onChange={(e) => setTrust(i, { icon: e.target.value === '__emoji' ? '⭐' : e.target.value })}
                    className="px-2 py-2 border rounded-lg text-xs bg-white w-36 shrink-0"
                    aria-label="Icon"
                  >
                    <option value="">No icon</option>
                    {Object.entries(ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    <option value="__emoji">Emoji (type below)</option>
                  </select>
                  {!ICONS[t.icon] && t.icon !== '' && (
                    <input className={input + ' w-16'} value={t.icon} onChange={(e) => setTrust(i, { icon: e.target.value })} aria-label="Emoji" />
                  )}
                  <input className={input} value={t.title} onChange={(e) => setTrust(i, { title: e.target.value })} placeholder="Title" />
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input className={input} value={t.text} onChange={(e) => setTrust(i, { text: e.target.value })} placeholder="Small text" />
                  <button type="button" onClick={() => set('trust_items', moveIn(trust, i, -1))} className={smallBtn} aria-label="Move up">↑</button>
                  <button type="button" onClick={() => set('trust_items', moveIn(trust, i, 1))} className={smallBtn} aria-label="Move down">↓</button>
                  <button type="button" onClick={() => { if (window.confirm('Delete this box?')) set('trust_items', trust.filter((_, idx) => idx !== i)); }} className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold cursor-pointer bg-white">Delete</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set('trust_items', [...trust, { icon: 'star', title: '', text: '' }])} className="text-xs font-bold text-amber-700 cursor-pointer">+ Add box</button>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">WhatsApp help strip</p>
            {check('show_whatsapp_strip', 'Show the WhatsApp help strip')}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Heading</label>
                <input className={input} value={f.wa_title} onChange={(e) => set('wa_title', e.target.value)} />
              </div>
              <div>
                <label className={label}>Button text</label>
                <input className={input} value={f.wa_button} onChange={(e) => set('wa_button', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Small text</label>
                <input className={input} value={f.wa_text} onChange={(e) => set('wa_text', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Message that opens in WhatsApp</label>
                <input className={input} value={f.wa_message} onChange={(e) => set('wa_message', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-extrabold text-slate-800">Footer</p>
            <div>
              <label className={label}>Line under the shop name</label>
              <input className={input} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Links column heading</label>
                <input className={input} value={f.quick_links_title} onChange={(e) => set('quick_links_title', e.target.value)} placeholder="Quick Links" />
              </div>
              <div>
                <label className={label}>Payments column heading</label>
                <input className={input} value={f.payments_title} onChange={(e) => set('payments_title', e.target.value)} placeholder="Payment Options" />
              </div>
            </div>
            {check('footer_show_categories', 'Show the categories as footer links')}
            {check('footer_show_payments', 'Show the payment options column')}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Extra footer links (for example Facebook page, Return Policy, Contact)</p>
              {links.map((l, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white border rounded-xl p-2">
                  <input className={input + ' sm:w-48'} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Text, e.g. Return Policy" />
                  <input className={input} value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="Link, e.g. https://... (optional)" />
                  <button type="button" onClick={() => set('footer_links', moveIn(links, i, -1))} className={smallBtn} aria-label="Move up">↑</button>
                  <button type="button" onClick={() => set('footer_links', moveIn(links, i, 1))} className={smallBtn} aria-label="Move down">↓</button>
                  <button type="button" onClick={() => set('footer_links', links.filter((_, idx) => idx !== i))} className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold cursor-pointer bg-white">Delete</button>
                </div>
              ))}
              <button type="button" onClick={() => set('footer_links', [...links, { label: '', url: '' }])} className="text-xs font-bold text-amber-700 cursor-pointer">+ Add link</button>
            </div>
            <div>
              <label className={label}>Text at the very bottom (optional)</label>
              <textarea rows={2} className={input} value={f.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {tab === 'brands' && (
        <div className="space-y-4 max-w-3xl">
          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            {check('show_brands', 'Show "Our Brands" on the home page')}
            <div>
              <label className={label}>Heading</label>
              <input className={input} value={f.brands_title} onChange={(e) => set('brands_title', e.target.value)} placeholder="Our Brands" />
            </div>
            {check('brands_slide', 'Logos keep sliding (stop when the mouse is on them)')}
            {f.brands_slide && (
              <div>
                <label className={label}>Sliding speed: {f.brands_speed < 18 ? 'fast' : f.brands_speed > 35 ? 'slow' : 'normal'}</label>
                <input type="range" min={8} max={60} step={1} value={68 - f.brands_speed} onChange={(e) => set('brands_speed', 68 - Number(e.target.value))} className="w-full max-w-xs accent-amber-600 cursor-pointer" aria-label="Sliding speed" />
                <div className="flex justify-between max-w-xs text-[10px] text-slate-400"><span>Slow</span><span>Fast</span></div>
              </div>
            )}
          </div>
          {brands.some((b) => b.logo_url) && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Preview (how the logos look on the website)</p>
              <div className="bg-white border rounded-xl py-4 px-2 flex flex-wrap justify-center items-center gap-6">
                {brands.filter((b) => b.logo_url).map((b, i) => (
                  <span key={i} className="h-14 w-32 flex items-center justify-center">
                    <BrandLogo src={b.logo_url} alt={b.name} removeBg={b.remove_bg} tone={b.tone} className="max-h-full max-w-full" />
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Add, rename or delete brands here, then press <b>Save Settings</b> at the bottom. When a shopper taps a brand, the shop searches for its
            <b> search word</b> (for example "Freecia") and shows those products. A logo is optional - without a logo the brand name is shown in a nice style.
          </p>
          <div className="space-y-2">
            {brands.length === 0 && <p className="text-sm text-slate-400 bg-white border rounded-xl p-4 text-center">No brands yet. Press "+ Add brand".</p>}
            {brands.map((b, i) => (
              <div key={i} className="bg-white border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-24 h-16 shrink-0 rounded-lg border bg-white flex items-center justify-center overflow-hidden p-1">
                    {b.logo_url ? <BrandLogo src={b.logo_url} alt="" removeBg={b.remove_bg} tone={b.tone} className="max-w-full max-h-full" /> : <span className="text-[10px] text-slate-400">No logo</span>}
                  </span>
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className={label}>Brand name</label>
                      <input className={input} value={b.name} onChange={(e) => setBrand(i, { name: e.target.value })} placeholder="e.g. Freecia Professional" />
                    </div>
                    <div>
                      <label className={label}>Search word</label>
                      <input className={input} value={b.keyword} onChange={(e) => setBrand(i, { keyword: e.target.value })} placeholder={b.name.split(' ')[0] || 'e.g. Freecia'} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 border rounded-lg text-xs font-bold text-amber-700 cursor-pointer">
                    {b.logo_url ? 'Change logo' : 'Add logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) uploadBrandLogo(i, fl); e.target.value = ''; }} />
                  </label>
                  {b.logo_url && <button type="button" onClick={() => setBrand(i, { logo_url: '' })} className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 cursor-pointer">Remove logo</button>}
                  {b.logo_url && (
                    <label className="flex items-center gap-1.5 px-2 py-1.5 border rounded-lg text-xs text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={b.remove_bg} onChange={(e) => setBrand(i, { remove_bg: e.target.checked })} /> Remove background
                    </label>
                  )}
                  {b.logo_url && (
                    <select value={b.tone} onChange={(e) => setBrand(i, { tone: e.target.value as any })} className="px-2 py-1.5 border rounded-lg text-xs bg-white cursor-pointer" aria-label="Logo colour">
                      <option value="original">Logo colours: original</option>
                      <option value="dark">Logo colours: all black</option>
                      <option value="light">Logo colours: all white</option>
                    </select>
                  )}
                  <button type="button" onClick={() => moveBrand(i, -1)} className="px-3 py-1.5 border rounded-lg text-xs cursor-pointer" aria-label="Move up">↑ Up</button>
                  <button type="button" onClick={() => moveBrand(i, 1)} className="px-3 py-1.5 border rounded-lg text-xs cursor-pointer" aria-label="Move down">↓ Down</button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Delete brand "${b.name || 'this brand'}"?`)) set('brands', brands.filter((_, idx) => idx !== i)); }}
                    className="ml-auto px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => set('brands', [...brands, { name: '', logo_url: '', keyword: '', remove_bg: true, tone: 'original' }])} className="px-4 py-2 rounded-xl border-2 border-dashed border-amber-400 text-amber-700 text-sm font-bold cursor-pointer w-full">+ Add brand</button>
        </div>
      )}

      {tab === 'look' && (
        <div className="space-y-5 max-w-3xl">
          <div>
            <label className={label}>Theme (one click changes colour, header and background)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((t) => {
                const sw = accentSwatch(t.accent);
                const active = f.accent === t.accent && f.header_style === t.header_style && f.page_bg === t.page_bg;
                const headBg = t.header_style === 'dark' ? '#0f172a' : t.header_style === 'light' ? '#ffffff' : sw;
                const pageBg = t.page_bg === 'white' ? '#ffffff' : t.page_bg === 'warm' ? '#f5f5f4' : '#f1f5f9';
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setF(prev => ({ ...prev, accent: t.accent, header_style: t.header_style, page_bg: t.page_bg }))}
                    className={`rounded-xl border-2 overflow-hidden text-left cursor-pointer ${active ? 'border-slate-900' : 'border-slate-200 hover:border-slate-400'}`}
                  >
                    <div style={{ background: pageBg }} className="h-20">
                      <div style={{ background: headBg }} className={`h-6 flex items-center gap-1 px-2 ${t.header_style === 'light' ? 'border-b' : ''}`}>
                        <span className="w-6 h-2 rounded-sm" style={{ background: t.header_style === 'light' ? '#0f172a' : '#ffffff' }} />
                        <span className="flex-1 h-2.5 rounded-sm bg-white border" />
                      </div>
                      <div className="flex gap-1.5 p-2">
                        <span className="flex-1 h-9 rounded bg-white shadow-sm" />
                        <span className="flex-1 h-9 rounded bg-white shadow-sm flex items-end p-1"><span className="w-full h-1.5 rounded-sm" style={{ background: sw }} /></span>
                      </div>
                    </div>
                    <div className="px-2 py-1.5 text-[11px] font-bold text-slate-700 bg-white border-t flex items-center justify-between">
                      {t.label}
                      {active && <span className="text-emerald-600">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Header style</label>
              <select className={input} value={f.header_style} onChange={(e) => set('header_style', e.target.value as any)}>
                <option value="color">Coloured (theme colour)</option>
                <option value="dark">Dark</option>
                <option value="light">White</option>
              </select>
            </div>
            <div>
              <label className={label}>Page background</label>
              <select className={input} value={f.page_bg} onChange={(e) => set('page_bg', e.target.value as any)}>
                <option value="gray">Light grey</option>
                <option value="white">White</option>
                <option value="warm">Warm grey</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Accent colour (buttons, prices, highlights)</label>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => set('accent', a.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${f.accent === a.key ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
                >
                  <span className="w-4 h-4 rounded-full" style={{ background: a.swatch }} /> {a.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 p-3 bg-white border rounded-xl">
              <span className="text-xs font-bold text-slate-700">Any colour:</span>
              <input
                type="color"
                value={accentSwatch(f.accent)}
                onChange={(e) => set('accent', e.target.value)}
                className="w-12 h-9 p-0 border rounded-lg cursor-pointer"
                aria-label="Pick any colour"
              />
              <input
                key={f.accent}
                className={input + ' max-w-[8rem] font-mono'}
                defaultValue={accentSwatch(f.accent)}
                onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) set('accent', v.toLowerCase()); }}
                aria-label="Colour code"
              />
              <span className="text-[11px] text-slate-500">Pick any colour, or type a colour code like #e11d48</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-2">
            <p className="text-xs font-bold text-slate-700">Colours of each part (any colour)</p>
            <p className="text-[11px] text-slate-500">Leave a part on "automatic" to use the theme. Text colour on the header and footer changes by itself so it stays readable.</p>
            {colorRow('header_color', 'Header (top bar with search)', accentSwatch(f.accent))}
            {colorRow('page_bg_color', 'Page background', '#f1f5f9')}
            {colorRow('topbar_color', 'Thin top line - background', '#f8fafc')}
            {colorRow('topbar_text_color', 'Thin top line - text', '#475569')}
            {colorRow('strip_color', 'Scrolling strip - background', accentSwatch(f.accent))}
            {colorRow('strip_text_color', 'Scrolling strip - text', '#ffffff')}
            {colorRow('footer_color', 'Footer', '#020617')}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            {check('show_announcement', 'Show the announcement bar at the top')}
            <input className={input} value={f.announcement} onChange={(e) => set('announcement', e.target.value)} placeholder="Announcement text" />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-xs font-bold text-slate-700">Home page sections</p>
            {check('show_trust', 'Trust badges (Original, Fast Delivery, ...)')}
            {check('show_categories', 'Categories')}
            {check('show_brands', 'Our Brands')}
            {check('show_whatsapp_strip', 'WhatsApp help strip')}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-xs font-bold text-slate-700">Search bar</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Shape</label>
                <select className={input} value={f.search_shape} onChange={(e) => set('search_shape', e.target.value as any)}>
                  <option value="rounded">Rounded corners</option>
                  <option value="pill">Fully round (pill)</option>
                  <option value="square">Square</option>
                </select>
              </div>
              <div>
                <label className={label}>Search button colour</label>
                <select className={input} value={f.search_button} onChange={(e) => set('search_button', e.target.value as any)}>
                  <option value="auto">Automatic (matches header)</option>
                  <option value="accent">Theme colour</option>
                  <option value="dark">Black</option>
                  <option value="light">White</option>
                </select>
              </div>
              <div>
                <label className={label}>Size</label>
                <select className={input} value={f.search_size} onChange={(e) => set('search_size', e.target.value as any)}>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Text inside the search bar</label>
              <input className={input} value={f.search_placeholder} onChange={(e) => set('search_placeholder', e.target.value)} placeholder={`Search in ${f.store_name}`} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Preview</p>
              {(() => {
                const r = f.search_shape;
                const big = f.search_size === 'large';
                const btn = f.search_button === 'dark' ? '#0f172a' : f.search_button === 'light' ? '#ffffff' : accentSwatch(f.accent);
                return (
                  <div className="flex max-w-md">
                    <div className={`flex-1 bg-white border ${r === 'pill' ? 'rounded-l-full pl-5' : r === 'square' ? '' : 'rounded-l-lg'} px-3 ${big ? 'py-3 text-base' : 'py-2 text-sm'} text-slate-400`}>
                      {f.search_placeholder.trim() || `Search in ${f.store_name}`}
                    </div>
                    <div className={`flex items-center justify-center border ${r === 'pill' ? 'rounded-r-full pr-5 pl-4' : r === 'square' ? 'px-4' : 'rounded-r-lg px-4'}`} style={{ background: btn, color: f.search_button === 'light' ? '#334155' : '#fff' }}>
                      ⌕
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-xs font-bold text-slate-700">Categories (home page)</p>
            <div>
              <label className={label}>Categories heading</label>
              <input className={input} value={f.categories_title} onChange={(e) => set('categories_title', e.target.value)} placeholder="Shop by Category" />
            </div>
            <p className="text-[11px] text-slate-500">Brands are managed in Admin &gt; Settings &gt; Our Brands.</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-xs font-bold text-slate-700">Scrolling strip (under the home page banner)</p>
            {check('show_marquee', 'Show the scrolling strip')}
            <div className="space-y-2">
              {items.map((m, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white border rounded-xl p-2">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-base">
                    <ShopIcon name={m.icon} />
                  </span>
                  <select
                    value={ICONS[m.icon] ? m.icon : (m.icon ? '__emoji' : '')}
                    onChange={(e) => setItem(i, { icon: e.target.value === '__emoji' ? '⭐' : e.target.value })}
                    className="px-2 py-2 border rounded-lg text-xs bg-white w-36 shrink-0"
                    aria-label="Icon"
                  >
                    <option value="">No icon</option>
                    {Object.entries(ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    <option value="__emoji">Emoji (type below)</option>
                  </select>
                  {!ICONS[m.icon] && m.icon !== '' && (
                    <input
                      value={m.icon}
                      onChange={(e) => setItem(i, { icon: e.target.value.slice(0, 4) })}
                      className="px-2 py-2 border rounded-lg text-sm w-14 text-center shrink-0"
                      aria-label="Emoji"
                    />
                  )}
                  <input
                    value={m.text}
                    onChange={(e) => setItem(i, { text: e.target.value })}
                    placeholder="Text, e.g. Free delivery in Karachi"
                    className="flex-1 min-w-[10rem] px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="px-2 py-1.5 bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="px-2 py-1.5 bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => set('marquee_items', items.filter((_, idx) => idx !== i))} className="px-2 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer">Delete</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('marquee_items', [...items, { icon: 'star', text: '' }])}
                className="text-xs font-bold bg-slate-900 text-amber-400 px-3 py-2 rounded-lg cursor-pointer"
              >
                + Add item
              </button>
            </div>
            <div>
              <label className={label}>Speed</label>
              <select className={input + ' max-w-xs'} value={String(f.marquee_speed)} onChange={(e) => set('marquee_speed', Number(e.target.value))}>
                <option value="45">Slow</option>
                <option value="30">Normal</option>
                <option value="18">Fast</option>
              </select>
            </div>
            {items.length > 0 && (
              <div className="bg-amber-500 text-white rounded-lg overflow-hidden whitespace-nowrap py-2 text-xs font-bold">
                <div className="marquee-track inline-flex" style={{ animationDuration: `${f.marquee_speed}s` }}>
                  {[0, 1].map((k) => (
                    <span key={k} className="inline-flex">
                      {items.map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 mx-5"><ShopIcon name={m.icon} />{m.text}</span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500">Press <b>Save Settings</b> at the bottom to put the changes on the website.</p>
          </div>

          <div>
            <label className={label}>Footer text (shown at the very bottom)</label>
            <textarea rows={2} className={input} value={f.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
          </div>

          <p className="text-xs text-slate-500">
            The home page slider is edited in the <b>Home Slides</b> tab. Products and categories have their own tabs.
          </p>
        </div>
      )}

      {tab === 'invoice' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              The invoice header uses your logo, store name, address, phone and email from the <b>Store Profile</b> tab.
            </p>
            {check('invoice_show_logo', 'Show logo on invoice')}
            <div>
              <label className={label}>Order number start (letters)</label>
              <input className={input + ' max-w-[10rem]'} value={f.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} />
              <p className="text-[11px] text-slate-400 mt-1">
                New orders get a number with the date: <b>{(f.invoice_prefix || 'SK')}-{new Date().toISOString().slice(2, 10).replace(/-/g, '')}-1001</b> (year-month-day, then the running number)
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
              <p className="text-xs font-bold text-slate-800">Sales Tax (GST) - FBR</p>
              {check('gst_enabled', 'Show GST on invoices (Sales Tax Invoice)')}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>NTN</label>
                  <input className={input} value={f.invoice_tax_id} onChange={(e) => set('invoice_tax_id', e.target.value)} placeholder="1234567-8" />
                </div>
                <div>
                  <label className={label}>STRN (Sales Tax Reg. No.)</label>
                  <input className={input} value={f.strn} onChange={(e) => set('strn', e.target.value)} placeholder="3277876123456" />
                </div>
                <div>
                  <label className={label}>GST rate (%)</label>
                  <input className={input} inputMode="decimal" value={String(f.gst_rate)} onChange={(e) => set('gst_rate', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)} />
                </div>
                <div>
                  <label className={label}>Product prices are</label>
                  <select className={input} value={f.gst_inclusive ? 'in' : 'ex'} onChange={(e) => set('gst_inclusive', e.target.value === 'in')}>
                    <option value="in">Including GST</option>
                    <option value="ex">Without GST (add GST at checkout)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                "Including GST": the customer pays the same price; the invoice shows how much of it is tax.
                "Without GST": the tax is added on top of the goods at checkout. Delivery is not taxed.
                Standard GST in Pakistan is 18% - check the rate for your products with your tax adviser.
              </p>
            </div>
            <div>
              <label className={label}>Note under the header (optional)</label>
              <textarea rows={2} className={input} value={f.invoice_header_note} onChange={(e) => set('invoice_header_note', e.target.value)} />
            </div>
            <div>
              <label className={label}>Footer note / terms</label>
              <textarea rows={2} className={input} value={f.invoice_footer_note} onChange={(e) => set('invoice_footer_note', e.target.value)} />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border space-y-2">
              {check('invoice_show_accounts', 'Show account details on invoice')}
              <p className="text-xs text-slate-500">Tick the accounts that should appear on the invoice:</p>
              {accounts.length === 0 && <p className="text-xs text-slate-400">No accounts yet.</p>}
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center space-x-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={(f.invoice_account_ids || []).includes(a.id)} onChange={() => toggleAccount(a.id)} />
                  <span><b>{a.type}</b> - {a.account_title} - {a.account_number}</span>
                </label>
              ))}
              <button type="button" onClick={onOpenAccounts} className="text-xs font-bold text-blue-700 underline cursor-pointer">
                Add / edit accounts (Bank Accounts tab)
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Live preview (save to apply)</p>
            <div className="border rounded-xl overflow-x-auto bg-slate-100 p-2">
              <InvoiceDocument order={sampleOrder} items={sampleItems} settings={f} accounts={accounts} />
            </div>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-5 max-w-2xl">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 mb-4">
            <p className="text-xs font-bold text-slate-800">AI chat assistant</p>
            {check('ai_chat_enabled', 'Show the AI chat button to customers on the shop')}
            <p className="text-[11px] text-slate-600">
              Free: works without any key (built-in bot). For a smarter real AI, add a free <b>GEMINI_API_KEY</b>
              (from aistudio.google.com) in Supabase &gt; Edge Functions &gt; Secrets. Needs the Edge Function <b>ai-chat</b>.
              The admin assistant is in the admin menu: <b>AI Assistant</b>.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-black text-slate-900">Invoice to the customer</p>
            {check('email_invoice_enabled', 'Email the invoice to the customer when an order is confirmed')}
            <div>
              <label className={label}>Sender name and address (optional)</label>
              <input
                className={input}
                value={f.email_from}
                onChange={(e) => set('email_from', e.target.value)}
                placeholder="My Store <orders@mydomain.com>"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Leave empty to use the Resend test sender. The test sender can only email your own Resend account address.
                To email real customers, verify your domain in Resend and enter an address on that domain here.
              </p>
            </div>
            <div>
              <label className={label}>Also send the invoice link to the customer's mobile</label>
              <select className={input} value={f.customer_msg_mode} onChange={(e) => set('customer_msg_mode', e.target.value as any)}>
                <option value="off">Off</option>
                <option value="sms">SMS (Twilio)</option>
                <option value="whatsapp">WhatsApp (Twilio)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Automatic SMS / WhatsApp needs a Twilio account (paid). See the README for the secrets to add.
                Without it you can still send the invoice link manually with the WhatsApp button in Orders.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-sm font-black text-slate-900">New products and deals</p>
            {check('notify_new_product', 'Tick "email customers" by default when I add a new product')}
            <p className="text-[11px] text-slate-500">
              Emails only go to customers who agreed to receive offers. You can also send a deal email to everyone from the Customers tab.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Alerts to <b>your</b> email / WhatsApp when an order arrives are set in the <b>Order Alerts</b> tab.
          </p>
        </div>
      )}

      <div className="mt-8 pt-4 border-t">
        <button
          type="submit"
          disabled={busy}
          className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-sm px-8 py-3 rounded-xl cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Please wait...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
