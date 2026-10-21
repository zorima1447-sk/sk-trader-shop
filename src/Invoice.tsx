import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { StoreSettings, defaultSettings, fetchStoreSettings } from './storeSettings';

// File name used when the invoice is saved as PDF: "<order no> - <customer name>"
export function invoiceFileName(order: any) {
  return `${order.invoice_no || 'Invoice'} - ${order.customer_name || 'Customer'}`.replace(/[\\/:*?"<>|]+/g, ' ').trim();
}

// Print / save as PDF with that file name (the browser takes the name from the page title)
export function printInvoice(order: any) {
  const old = document.title;
  document.title = invoiceFileName(order);
  const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
  setTimeout(restore, 60000); // some phones do not send "afterprint"
}

export interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
      })
    : '-';

interface DocProps {
  order: any;
  items: InvoiceItem[];
  settings: StoreSettings;
  accounts: any[];
}

// Printable invoice. Wrap it in an element with id="invoice-print" to print only the invoice.
export function InvoiceDocument({ order, items, settings, accounts }: DocProps) {
  const total = Number(order.total_amount || 0);
  const paid = Number(order.paid_amount || 0);
  const balance = Math.max(total - paid, 0);
  const status = total > 0 && paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY PAID' : 'UNPAID';
  const statusCls =
    status === 'PAID' ? 'text-emerald-700 border-emerald-600' : status === 'UNPAID' ? 'text-red-600 border-red-500' : 'text-amber-700 border-amber-500';

  const chosen = (settings.invoice_account_ids || []);
  const shownAccounts = settings.invoice_show_accounts ? accounts.filter((a) => chosen.includes(a.id)) : [];

  return (
    <div className="bg-white text-slate-900 p-6 md:p-8 max-w-3xl mx-auto text-sm" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="flex justify-between items-start gap-4 border-b-2 border-slate-900 pb-4">
        <div className="flex items-start gap-3">
          {settings.invoice_show_logo && settings.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
          )}
          <div>
            <h1 className="text-xl font-black">{settings.store_name}</h1>
            {settings.address && <p className="text-xs text-slate-600 whitespace-pre-line">{settings.address}</p>}
            {settings.phone && <p className="text-xs text-slate-600">Phone: {settings.phone}</p>}
            {settings.email && <p className="text-xs text-slate-600">Email: {settings.email}</p>}
            {settings.invoice_tax_id && <p className="text-xs text-slate-600">NTN: {settings.invoice_tax_id}</p>}
            {settings.strn && Number(order.gst_amount || 0) > 0 && <p className="text-xs text-slate-600">STRN: {settings.strn}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-black tracking-widest">{Number(order.gst_amount || 0) > 0 ? 'SALES TAX INVOICE' : 'INVOICE'}</h2>
          <p className="text-xs mt-1">No: <b>{order.invoice_no || '-'}</b></p>
          <p className="text-xs">Date: {fmt(order.created_at)}</p>
          <span className={`inline-block mt-2 border-2 px-2 py-0.5 text-[11px] font-black rounded ${statusCls}`}>{status}</span>
        </div>
      </div>

      {settings.invoice_header_note && (
        <p className="text-xs text-slate-600 mt-3 whitespace-pre-line">{settings.invoice_header_note}</p>
      )}

      <div className="mt-4 text-xs">
        <p className="font-black uppercase text-slate-500 mb-1">Bill To</p>
        <p className="font-bold text-sm">{order.customer_name}</p>
        {order.customer_phone && <p>Phone: {order.customer_phone}</p>}
        {order.customer_email && <p>Email: {order.customer_email}</p>}
        {order.shipping_address && <p className="text-slate-600">{order.shipping_address}</p>}
      </div>

      <table className="w-full mt-5 text-xs border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="text-left p-2">#</th>
            <th className="text-left p-2">Item</th>
            <th className="text-right p-2">Qty</th>
            <th className="text-right p-2">Unit Price</th>
            <th className="text-right p-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{i + 1}</td>
              <td className="p-2">{it.product_name}</td>
              <td className="p-2 text-right">{it.quantity}</td>
              <td className="p-2 text-right">PKR {Number(it.unit_price)}</td>
              <td className="p-2 text-right">PKR {Number(it.unit_price) * Number(it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64 text-xs space-y-1">
        {(() => {
          const dc = Number(order.delivery_charge || 0);
          const gst = Number(order.gst_amount || 0);
          const goods = Number(order.subtotal ?? total - dc - (order.gst_inclusive === false ? gst : 0));
          if (!dc && !gst) return null;
          return (
            <>
              {gst > 0 && order.gst_inclusive !== false ? (
                <>
                  <div className="flex justify-between"><span>Value excl. sales tax</span><span>PKR {(goods - gst).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Sales tax (GST) @ {Number(order.gst_rate)}%</span><span>PKR {gst.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Goods incl. sales tax</span><span>PKR {goods}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>Subtotal{gst > 0 ? ' (excl. tax)' : ''}</span><span>PKR {goods}</span></div>
                  {gst > 0 && <div className="flex justify-between"><span>Sales tax (GST) @ {Number(order.gst_rate)}%</span><span>PKR {gst.toFixed(2)}</span></div>}
                </>
              )}
              {dc > 0 && <div className="flex justify-between"><span>Delivery{order.city ? ` (${order.city})` : ''}</span><span>PKR {dc}</span></div>}
            </>
          );
        })()}
        <div className="flex justify-between"><span>Total</span><b>PKR {total}</b></div>
        <div className="flex justify-between"><span>Paid</span><b className="text-emerald-700">PKR {paid}</b></div>
        <div className="flex justify-between border-t pt-1 text-sm"><span className="font-black">Balance Due</span><b className="text-red-600">PKR {balance}</b></div>
      </div>

      <div className="mt-4 text-xs">
        <span className="font-bold">Payment method:</span> {String(order.payment_method || '').toUpperCase()}
        {order.transaction_id ? <span> | Txn ID: {order.transaction_id}</span> : null}
      </div>

      {shownAccounts.length > 0 && (
        <div className="mt-4 border rounded-lg p-3 text-xs">
          <p className="font-black uppercase text-slate-500 mb-1">Pay to our accounts</p>
          {shownAccounts.map((a) => (
            <p key={a.id}>
              <b>{a.type}</b> - {a.account_title} - {a.account_number}
            </p>
          ))}
        </div>
      )}

      {settings.invoice_footer_note && (
        <p className="text-center text-xs text-slate-500 mt-6 whitespace-pre-line">{settings.invoice_footer_note}</p>
      )}
    </div>
  );
}

// Public invoice page: open  https://your-site/?invoice=<order id>
export function InvoicePage({ orderId }: { orderId: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);

  useEffect(() => {
    (async () => {
      // get_invoice() returns only this one order and its items (orders are private otherwise)
      const { data: inv } = await supabase.rpc('get_invoice', { p_order_id: orderId });
      if (!inv || !inv.order) { setState('missing'); return; }
      const { data: acc } = await supabase.from('payment_accounts').select('*');
      setOrder(inv.order);
      document.title = invoiceFileName(inv.order);
      setItems(inv.items || []);
      setAccounts(acc || []);
      setSettings(await fetchStoreSettings(supabase));
      setState('ready');
    })();
  }, [orderId]);

  if (state === 'loading') return <div className="p-10 text-center text-slate-500">Loading invoice...</div>;
  if (state === 'missing') return <div className="p-10 text-center text-slate-500">Invoice not found.</div>;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="max-w-3xl mx-auto mb-3 flex justify-end no-print px-4">
        <button onClick={() => printInvoice(order)} className="bg-slate-900 text-amber-400 font-bold text-sm px-5 py-2.5 rounded-xl cursor-pointer">
          Print / Save as PDF
        </button>
      </div>
      <div id="invoice-print" className="shadow-xl">
        <InvoiceDocument order={order} items={items} settings={settings} accounts={accounts} />
      </div>
    </div>
  );
}
