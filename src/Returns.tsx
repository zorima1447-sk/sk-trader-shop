import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Returns: the customer's return form (on the /returns page) and the admin list.
// ---------------------------------------------------------------------------

const REASONS = [
  'Damaged / broken / leaking product',
  'Wrong product, shade or size',
  'Item missing from the parcel',
  'Expired product',
  'Other',
];

export const RETURN_STATUSES = ['Requested', 'Approved', 'Rejected', 'Received', 'Refunded', 'Exchanged'];

const statusColor = (s: string) =>
  s === 'Requested' ? 'bg-amber-100 text-amber-800'
    : s === 'Approved' || s === 'Received' ? 'bg-sky-100 text-sky-800'
    : s === 'Rejected' ? 'bg-red-100 text-red-700'
    : 'bg-emerald-100 text-emerald-800';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const box = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500';
const lbl = 'block text-xs font-semibold text-slate-600 mb-1';

type Item = { product_name: string; variant?: string | null; quantity: number };

// ---------------- customer form ----------------
export function ReturnForm({ whatsapp }: { whatsapp?: string }) {
  const [inv, setInv] = useState(() => { try { return new URLSearchParams(window.location.search).get('order') || ''; } catch { return ''; } });
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [pick, setPick] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [want, setWant] = useState<'refund' | 'exchange'>('exchange');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setDone(''); setOrder(null);
    if (!inv.trim() || phone.replace(/\D/g, '').length < 9) { setErr('Please enter your order number and mobile number.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('return_lookup', { p_invoice: inv.trim(), p_phone: phone });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^.*?: /, '')); return; }
    setOrder(data); setPick({});
  };

  const send = async () => {
    setErr('');
    const items: Item[] = (order.items || []).map((it: Item, i: number) => ({ ...it, quantity: pick[i] || 0 })).filter((it: Item) => it.quantity > 0);
    if (!items.length) { setErr('Please tick the items you want to return.'); return; }
    if (!reason) { setErr('Please choose the reason.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('request_return', { p_invoice: inv.trim(), p_phone: phone, p_items: items, p_reason: reason, p_details: details, p_resolution: want });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone((data as any)?.ref || 'sent');
    const { data: again } = await supabase.rpc('return_lookup', { p_invoice: inv.trim(), p_phone: phone });
    if (again) setOrder(again);
  };

  const wa = (whatsapp || '').replace(/\D/g, '');
  const open = (order?.requests || []).some((r: any) => r.status === 'Requested' || r.status === 'Approved');

  return (
    <div id="return-form" className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4 sm:p-6">
      <h2 className="text-xl font-black text-slate-900">Request a return</h2>
      <p className="text-sm text-slate-600 mt-1">Enter the order number (from your invoice / SMS, e.g. SK-261024-1015) and the mobile number used for the order. You can also check the status of your return here.</p>
      <form onSubmit={find} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-4">
        <div><label className={lbl}>Order number</label><input className={box} value={inv} onChange={(e) => setInv(e.target.value.toUpperCase())} placeholder="SK-261024-1015" /></div>
        <div><label className={lbl}>Mobile number</label><input className={box} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX XXXXXXX" inputMode="tel" /></div>
        <div className="flex items-end"><button disabled={busy} className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">{busy && !order ? 'Checking…' : 'Find my order'}</button></div>
      </form>
      {err && <p className="mt-3 text-sm font-semibold text-red-600">{err}</p>}

      {order && (
        <div className="mt-5 space-y-4">
          <div className="bg-white rounded-xl border p-3 text-sm">
            <p><b>{order.invoice_no}</b> · {order.customer_name} · {fmt(order.created_at)} · <span className="font-semibold">{order.status}</span></p>
            <p className="text-xs text-slate-500 mt-0.5">Return possible until {fmt(order.return_until)}</p>
          </div>

          {(order.requests || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-800">Your return requests</p>
              {order.requests.map((r: any) => (
                <div key={r.ref} className="bg-white rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>{r.ref}</b> · {fmt(r.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(r.status)}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{(r.items || []).map((it: Item) => `${it.quantity} x ${it.product_name}${it.variant ? ` (${it.variant})` : ''}`).join(', ')} · {r.reason}</p>
                  {r.refund_amount ? <p className="text-xs text-emerald-700 font-semibold mt-1">Refund: Rs. {Number(r.refund_amount).toLocaleString('en-PK')}</p> : null}
                  {r.admin_note && <p className="text-xs mt-1 bg-slate-50 rounded p-2"><b>SK Trader:</b> {r.admin_note}</p>}
                </div>
              ))}
            </div>
          )}

          {done && <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">Thank you! Your return request {done} has been received. We will contact you within 1-2 working days.</p>}

          {!order.can_return && <p className="text-sm text-red-600 font-semibold">The time to return this order is over. Please contact us{wa ? <> on <a className="underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></> : ''}.</p>}

          {order.can_return && !open && !done && (
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <div>
                <p className={lbl}>Which items? (tick and choose the quantity)</p>
                <div className="space-y-2">
                  {(order.items || []).map((it: Item, i: number) => (
                    <label key={i} className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2 cursor-pointer">
                      <input type="checkbox" checked={(pick[i] || 0) > 0} onChange={(e) => setPick({ ...pick, [i]: e.target.checked ? Number(it.quantity) || 1 : 0 })} />
                      <span className="flex-1">{it.product_name}{it.variant && !String(it.product_name).includes(String(it.variant)) ? ` (${it.variant})` : ''}</span>
                      {(pick[i] || 0) > 0 && Number(it.quantity) > 1 && (
                        <select className="border rounded px-1 py-0.5" value={pick[i]} onChange={(e) => setPick({ ...pick, [i]: Number(e.target.value) })}>
                          {Array.from({ length: Number(it.quantity) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      )}
                      <span className="text-xs text-slate-500">of {it.quantity}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Reason</label>
                <select className={box} value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Choose…</option>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Tell us more (optional)</label>
                <textarea className={box} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What is wrong? Please also send photos / video on WhatsApp." />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="font-semibold text-slate-700">I want:</span>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={want === 'exchange'} onChange={() => setWant('exchange')} /> Exchange / replacement</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={want === 'refund'} onChange={() => setWant('refund')} /> Refund</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={send} className="px-6 py-2.5 rounded-lg bg-amber-600 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">{busy ? 'Sending…' : 'Send return request'}</button>
                {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Return request for order ${order.invoice_no} - photos:`)}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm">Send photos on WhatsApp</a>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- admin ----------------
export function ReturnsAdmin({ returnDays, onSaveDays, storeName, onCount }: { returnDays: number; onSaveDays: (n: number) => Promise<boolean>; storeName: string; onCount?: (n: number) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [edit, setEdit] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState('');
  const [days, setDays] = useState(String(returnDays));
  useEffect(() => setDays(String(returnDays)), [returnDays]);

  const load = async () => {
    const { data, error } = await supabase.from('return_requests').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) { setMsg(/return_requests/.test(error.message) ? 'Run supabase_v23.sql once in Supabase > SQL Editor to switch on Returns.' : error.message); setRows([]); return; }
    setRows(data || []);
    onCount && onCount((data || []).filter((r: any) => r.status === 'Requested').length);
  };
  useEffect(() => { load(); }, []);

  const save = async (r: any) => {
    const e = edit[r.id] || {};
    const patch: any = {
      status: e.status ?? r.status,
      admin_note: (e.admin_note ?? r.admin_note ?? '') || null,
      refund_amount: (e.refund_amount ?? r.refund_amount) === '' || (e.refund_amount ?? r.refund_amount) == null ? null : Number(e.refund_amount ?? r.refund_amount),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('return_requests').update(patch).eq('id', r.id);
    if (error) { setMsg(error.message); return; }
    setEdit((x) => { const n = { ...x }; delete n[r.id]; return n; });
    setMsg(`${r.ref} saved.`);
    load();
  };

  const remove = async (r: any) => {
    if (!window.confirm(`Delete return request ${r.ref}?`)) return;
    const { error } = await supabase.from('return_requests').delete().eq('id', r.id);
    if (error) { setMsg(error.message); return; }
    load();
  };

  const waLink = (r: any) => {
    const st = edit[r.id]?.status ?? r.status;
    const note = edit[r.id]?.admin_note ?? r.admin_note ?? '';
    const amt = edit[r.id]?.refund_amount ?? r.refund_amount;
    const text = `Assalam o Alaikum ${r.customer_name || ''}, ${storeName}: your return request ${r.ref} (order ${r.invoice_no}) is now: ${st}.` +
      (amt ? ` Refund: Rs. ${Number(amt).toLocaleString('en-PK')}.` : '') + (note ? ` ${note}` : '');
    const ph = String(r.customer_phone || '').replace(/\D/g, '').replace(/^0/, '92');
    return `https://wa.me/${ph}?text=${encodeURIComponent(text)}`;
  };

  const list = (rows || []).filter((r) => filter === 'all' ? true : filter === 'open' ? ['Requested', 'Approved', 'Received'].includes(r.status) : r.status === filter);
  const count = (st: string) => (rows || []).filter((r) => r.status === st).length;
  const inp = 'px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">{msg}</div>}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Customers can request a return within (days)</label>
          <input className={inp + ' w-24'} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button onClick={async () => setMsg((await onSaveDays(Number(days) || 7)) ? 'Saved.' : 'Could not save (run supabase_v23.sql once).')} className="px-4 py-2 rounded-lg bg-slate-900 text-amber-400 text-sm font-bold cursor-pointer">Save</button>
        <a href="/returns" target="_blank" rel="noreferrer" className="text-sm text-amber-700 underline ml-auto">Open the customer return page</a>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['open', `Open (${count('Requested') + count('Approved') + count('Received')})`], ...RETURN_STATUSES.map((s) => [s, `${s} (${count(s)})`]), ['all', `All (${(rows || []).length})`]].map(([k, t]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {rows === null ? <p className="text-slate-400">Loading…</p> : list.length === 0 ? <p className="text-slate-400 text-sm">No return requests here.</p> : list.map((r) => {
        const e = edit[r.id] || {};
        const set = (k: string, v: any) => setEdit((x) => ({ ...x, [r.id]: { ...(x[r.id] || {}), [k]: v } }));
        return (
          <div key={r.id} className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{r.ref} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(r.status)}`}>{r.status}</span></p>
                <p className="text-xs text-slate-500">Order {r.invoice_no} · {r.customer_name} · {r.customer_phone} · {fmt(r.created_at)}</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-lg px-2 py-1">Wants: {r.resolution === 'refund' ? 'Refund' : 'Exchange'}</span>
            </div>
            <div className="text-sm">
              <p><b>Items:</b> {(r.items || []).map((it: Item) => `${it.quantity} x ${it.product_name}${it.variant && !String(it.product_name).includes(String(it.variant)) ? ` (${it.variant})` : ''}`).join(', ')}</p>
              <p><b>Reason:</b> {r.reason}</p>
              {r.details && <p className="text-slate-600 whitespace-pre-line"><b>Details:</b> {r.details}</p>}
            </div>
            <div className="grid sm:grid-cols-[10rem_9rem_1fr] gap-2">
              <select className={inp} value={e.status ?? r.status} onChange={(ev) => set('status', ev.target.value)}>
                {RETURN_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input className={inp} inputMode="numeric" placeholder="Refund Rs." value={e.refund_amount ?? (r.refund_amount ?? '')} onChange={(ev) => set('refund_amount', ev.target.value.replace(/[^0-9.]/g, ''))} />
              <input className={inp} placeholder="Message to the customer (shown on the return page)" value={e.admin_note ?? (r.admin_note || '')} onChange={(ev) => set('admin_note', ev.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => save(r)} className="px-4 py-2 rounded-lg bg-slate-900 text-amber-400 text-sm font-bold cursor-pointer">Save</button>
              <a href={waLink(r)} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">Tell customer on WhatsApp</a>
              <button onClick={() => remove(r)} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold ml-auto cursor-pointer">Delete</button>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-500">Steps: Requested → Approved (tell the customer how to send it back) → Received (you got the product) → Refunded or Exchanged. Rejected = not accepted (write the reason in the message).</p>
    </div>
  );
}
