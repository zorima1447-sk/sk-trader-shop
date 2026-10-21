import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Truck, Package, CheckCircle2, Clock } from 'lucide-react';

// Couriers the admin can choose (Admin > Orders > Courier & tracking)
export const COURIERS = [
  'Own delivery (rider)',
  'TCS',
  'Leopards Courier',
  'M&P (Muller & Phipps)',
  'Trax',
  'PostEx',
  'BlueEx',
  'Call Courier',
  'Rider (Daewoo / bus cargo)',
  'Pakistan Post',
  'Other'
];

// Link that opens the courier's tracking: the link the admin pasted, otherwise a web search for courier + number
export function trackingLink(o: { courier?: string | null; tracking_no?: string | null; tracking_url?: string | null }) {
  if (o.tracking_url && /^https?:\/\//.test(o.tracking_url)) return o.tracking_url;
  if (!o.tracking_no || !o.courier || /own delivery/i.test(o.courier)) return '';
  return `https://www.google.com/search?q=${encodeURIComponent(`${o.courier} tracking ${o.tracking_no}`)}`;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';

// Placed -> Confirmed -> Shipped -> Delivered
export function TrackTimeline({ o }: { o: any }) {
  const status = o.status || 'Pending';
  if (status === 'Cancelled') {
    return <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">This order was cancelled.</p>;
  }
  const order = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
  const at = order.indexOf(status);
  const steps = [
    { label: 'Order placed', time: o.created_at, Icon: Clock },
    { label: 'Confirmed', time: o.confirmed_at, Icon: CheckCircle2 },
    { label: 'Shipped', time: o.shipped_at, Icon: Truck },
    { label: 'Delivered', time: o.delivered_at, Icon: Package }
  ];
  const link = trackingLink(o);
  return (
    <div>
      <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
        {steps.map((st, i) => {
          const done = i <= at;
          return (
            <li key={st.label} className="ml-5">
              <span className={`absolute -left-[13px] w-6 h-6 rounded-full flex items-center justify-center ${done ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                <st.Icon className="w-3.5 h-3.5" />
              </span>
              <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>{st.label}</p>
              {done && st.time && <p className="text-[11px] text-slate-500">{fmt(st.time)}</p>}
              {i === 2 && done && (o.courier || o.tracking_no) && (
                <div className="mt-1.5 bg-slate-50 border rounded-lg p-2.5 text-xs space-y-1">
                  {o.courier && <p>Courier: <b>{o.courier}</b></p>}
                  {o.tracking_no && (
                    <p className="flex items-center gap-2 flex-wrap">
                      Tracking no: <b className="font-mono">{o.tracking_no}</b>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(o.tracking_no)} className="text-[11px] border border-amber-600 text-amber-700 px-1.5 rounded cursor-pointer">Copy</button>
                    </p>
                  )}
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" className="inline-block mt-1 bg-amber-600 text-white font-semibold px-3 py-1.5 rounded">
                      Track with courier
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Public "Track Order" page
export function TrackOrderPage({ onBack }: { onBack: () => void }) {
  const [no, setNo] = useState(() => new URLSearchParams(window.location.search).get('track') || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [o, setO] = useState<any>(null);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setO(null);
    if (!no.trim() || phone.replace(/\D/g, '').length < 4) { setErr('Please enter the order number and the last 4 digits of your mobile number.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('track_order', { p_order_no: no.trim(), p_phone: phone });
    setBusy(false);
    if (error || !data) { setErr('No order found with this number and mobile. Please check both.'); return; }
    setO(data);
  };

  const box = 'w-full px-4 py-3 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:border-amber-500';
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline cursor-pointer">← Back to Shop</button>
      <h1 className="text-xl sm:text-2xl text-slate-800 mb-4">Track your order</h1>
      <form onSubmit={find} className="bg-white shadow-sm rounded p-4 sm:p-6 grid sm:grid-cols-[1fr_12rem_auto] gap-3 items-end">
        <div>
          <label className="block text-sm text-slate-700 mb-1.5">Order number*</label>
          <input value={no} onChange={(e) => setNo(e.target.value.toUpperCase())} placeholder="e.g. SK-261022-1005" className={box + ' font-mono'} />
        </div>
        <div>
          <label className="block text-sm text-slate-700 mb-1.5">Mobile (last 4 digits)*</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(-11))} placeholder="e.g. 4567" inputMode="numeric" className={box} />
        </div>
        <button disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded text-sm font-semibold cursor-pointer disabled:opacity-60">
          {busy ? '...' : 'TRACK'}
        </button>
      </form>
      {err && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}

      {o && (
        <div className="mt-5 bg-white shadow-sm rounded p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">Order</p>
              <p className="font-bold text-slate-900">{o.invoice_no}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{o.city || ''}</p>
              <p className="font-bold text-amber-600">Rs. {Number(o.total_amount || 0).toLocaleString('en-PK')}</p>
            </div>
          </div>
          <TrackTimeline o={o} />
          <div className="border-t pt-3 text-xs text-slate-600 space-y-0.5">
            {(o.items || []).map((it: any, i: number) => <p key={i}>{it.quantity} x {it.product_name}</p>)}
            <p className="pt-1">Payment: {o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_method} · {o.payment_status === 'Paid' ? 'Paid' : 'Payment pending'}</p>
            <a href={`/?invoice=${o.order_id}`} target="_blank" rel="noreferrer" className="inline-block pt-1 text-sky-600 underline">View invoice</a>
          </div>
        </div>
      )}
    </div>
  );
}
