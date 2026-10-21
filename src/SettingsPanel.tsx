import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { StoreSettings, ACCENTS, THEMES, MarqueeItem, deliveryChargeFor } from './storeSettings';
import { ICONS, ShopIcon } from './icons';
import { PROVINCES } from './pakistan';
import { InvoiceDocument } from './Invoice';

export type SettingsTab = 'profile' | 'look' | 'invoice' | 'messages' | 'delivery';

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
      alert('Database error (settings save):\n' + error.message);
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
        {{ profile: 'Store Profile', look: 'Website Look & Theme', invoice: 'Invoice', messages: 'Customer Messages', delivery: 'Delivery Charges' }[tab]}
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
          <div className="bg-slate-50 border rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p><b>Example:</b> order of Rs. 3,000</p>
            {[['Sindh', 'Karachi'], ['Sindh', 'Hyderabad'], ['Punjab', 'Lahore'], ['Khyber Pakhtunkhwa', 'Peshawar']].map(([pv, ct]) => {
              const dc = deliveryChargeFor(f, pv, ct, 3000);
              return <p key={ct}>{ct}: delivery {dc > 0 ? `Rs. ${dc}` : 'FREE'}</p>;
            })}
          </div>
        </div>
      )}

      {tab === 'look' && (
        <div className="space-y-5 max-w-3xl">
          <div>
            <label className={label}>Theme (one click changes colour, header and background)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((t) => {
                const sw = (ACCENTS.find(a => a.key === t.accent) || ACCENTS[0]).swatch;
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
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            {check('show_announcement', 'Show the announcement bar at the top')}
            <input className={input} value={f.announcement} onChange={(e) => set('announcement', e.target.value)} placeholder="Announcement text" />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
            <p className="text-xs font-bold text-slate-700">Home page sections</p>
            {check('show_trust', 'Trust badges (Original, Fast Delivery, ...)')}
            {check('show_categories', 'Shop by category tiles')}
            {check('show_whatsapp_strip', 'WhatsApp help strip')}
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
              <label className={label}>Tax / NTN number (optional)</label>
              <input className={input} value={f.invoice_tax_id} onChange={(e) => set('invoice_tax_id', e.target.value)} />
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
