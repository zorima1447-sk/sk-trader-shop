import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Admin > Visitors Report: who came, from where, what they looked at and what they bought.
type Row = Record<string, any>;
type Stats = {
  totals: Row; today: Row; daily: Row[]; products: Row[]; cities: Row[];
  sources: Row[]; devices: Row[]; searches: Row[]; customers: Row[]; recent: Row[];
};

const PERIODS = [
  { d: 1, label: 'Today' },
  { d: 7, label: '7 days' },
  { d: 30, label: '30 days' },
  { d: 90, label: '90 days' },
];

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', google: 'Google', tiktok: 'TikTok',
  youtube: 'YouTube', search: 'Other search engines', direct: 'Direct / typed the link', other: 'Other websites',
};
const EVENT_LABEL: Record<string, string> = {
  visit: 'opened the shop', product_view: 'viewed', add_to_cart: 'added to cart', search: 'searched', checkout: 'went to checkout', order: 'placed an order',
};
const EVENT_DOT: Record<string, string> = {
  visit: 'bg-slate-400', product_view: 'bg-sky-500', add_to_cart: 'bg-amber-500', search: 'bg-violet-500', checkout: 'bg-orange-500', order: 'bg-emerald-500',
};

const n = (v: any) => Number(v || 0).toLocaleString('en-PK');
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="font-bold text-slate-800">{title}</h3>
        {note && <span className="text-xs text-slate-400">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Bars({ rows, total }: { rows: { name: string; value: number }[]; total: number }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No data yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex justify-between text-sm"><span className="text-slate-700 truncate pr-2">{r.name}</span><span className="font-semibold text-slate-800">{n(r.value)} <span className="text-slate-400 font-normal text-xs">{pct(r.value, total)}</span></span></div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${total ? Math.max(3, (r.value / total) * 100) : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function VisitorsReport({ onOpenProduct }: { onOpenProduct?: (id: string) => void }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blog, setBlog] = useState<Row[] | null>(null);

  const load = async (d = days) => {
    setLoading(true); setError('');
    const { data: res, error: e } = await supabase.rpc('admin_visit_stats', { p_days: d });
    setLoading(false);
    if (e) {
      setError(/admin_visit_stats|function|schema cache/i.test(e.message)
        ? 'The Visitors Report is not switched on yet. Run the file supabase_analytics.sql once in Supabase > SQL Editor, then press Refresh.'
        : e.message);
      return;
    }
    setData(res as Stats);
    const b = await supabase.rpc('admin_blog_stats', { p_days: d });
    setBlog(b.error ? null : ((b.data as any[]) || []));
  };

  // Download PDF: opens the report alone in a print window -> "Save as PDF"
  const downloadPdf = () => {
    const el = document.getElementById('visitors-report');
    if (!el) return;
    const name = `SK-Trader-Visitors-Report-${(PERIODS.find((p) => p.d === days)?.label || days + ' days').replace(/\s/g, '')}-${new Date().toISOString().slice(0, 10)}`;
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((e) => e.outerHTML).join('');
    const w = window.open('', '_blank');
    if (!w) {
      // pop-ups blocked: print this page (only the report is printed)
      document.body.classList.add('print-report');
      const done = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${name}</title>${css}
      <style>body{background:#fff;padding:16px;font-family:system-ui,sans-serif}.no-print{display:none!important}.print-only{display:block!important}
      .max-h-80,.max-h-96{max-height:none!important;overflow:visible!important}#visitors-report>*{break-inside:avoid}@page{size:A4;margin:10mm}</style>
      </head><body>${el.outerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},400)};<\/script></body></html>`);
    w.document.close();
  };

  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  const t = data?.totals || {};
  const tiles = [
    { label: 'Visitors', value: t.visitors, sub: data ? `${n(data.today?.visitors)} today` : '' },
    { label: 'Visits', value: t.visits, sub: 'separate times the shop was opened' },
    { label: 'Product views', value: t.product_views, sub: data ? `${n(data.today?.product_views)} today` : '' },
    { label: 'Added to cart', value: t.add_to_cart, sub: `${pct(Number(t.add_to_cart || 0), Number(t.product_views || 0))} of views` },
    { label: 'Orders', value: t.orders, sub: `${pct(Number(t.orders || 0), Number(t.visitors || 0))} of visitors bought` },
    { label: 'Logged-in customers', value: t.customers, sub: 'known by name' },
  ];

  const daily = data?.daily || [];
  const maxDay = Math.max(1, ...daily.map((d) => Number(d.visitors || 0)));
  const srcTotal = (data?.sources || []).reduce((a, r) => a + Number(r.visitors || 0), 0);
  const devTotal = (data?.devices || []).reduce((a, r) => a + Number(r.visitors || 0), 0);
  const cityTotal = (data?.cities || []).reduce((a, r) => a + Number(r.visitors || 0), 0);

  return (
    <div className="space-y-5" id="visitors-report">
      <div className="print-only">
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>SK TRADER - Visitors Report</h1>
        <p style={{ fontSize: 12, color: '#475569' }}>Period: {PERIODS.find((p) => p.d === days)?.label} · Printed {new Date().toLocaleString('en-GB')} · sktraderpk.com</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <p className="text-sm text-slate-500">Who visits your shop, where they come from, and what they look at. Your own admin visits are not counted.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button key={p.d} onClick={() => setDays(p.d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${days === p.d ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>{p.label}</button>
          ))}
          <button onClick={() => load()} className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50">{loading ? 'Loading…' : 'Refresh'}</button>
          <button onClick={downloadPdf} disabled={!data} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-900 text-white disabled:opacity-40">⬇ Download PDF</button>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {tiles.map((x) => (
              <div key={x.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{x.label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{n(x.value)}</div>
                <div className="text-xs text-slate-400 mt-1">{x.sub}</div>
              </div>
            ))}
          </div>

          {days > 1 && (
            <Card title="Visitors per day" note="hover a bar for details">
              {daily.length === 0 ? <p className="text-sm text-slate-400">No visits yet.</p> : (
                <div className="flex items-end gap-1 h-40 overflow-x-auto">
                  {daily.map((d) => (
                    <div key={d.day} className="flex-1 min-w-[10px] flex flex-col items-center justify-end h-full group" title={`${d.day}: ${d.visitors} visitors, ${d.product_views} product views, ${d.orders} orders`}>
                      <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">{d.visitors}</span>
                      <div className="w-full bg-amber-500 group-hover:bg-amber-600 rounded-t" style={{ height: `${(Number(d.visitors) / maxDay) * 100}%`, minHeight: 2 }} />
                      <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{String(d.day).slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card title="Most viewed products" note="views · people · added to cart · sold">
            {(data.products || []).length === 0 ? <p className="text-sm text-slate-400">No product views yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-2">Product</th><th className="py-2 px-2 text-right">Views</th><th className="py-2 px-2 text-right">People</th>
                    <th className="py-2 px-2 text-right">Cart</th><th className="py-2 px-2 text-right">Sold</th><th className="py-2 pl-2 text-right">Buy rate</th>
                  </tr></thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.product_id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-2">
                          <button className="flex items-center gap-2 text-left" onClick={() => onOpenProduct && onOpenProduct(p.product_id)}>
                            {p.image_url ? <img src={p.image_url} alt="" className="w-9 h-9 rounded object-cover bg-slate-100" loading="lazy" /> : <span className="w-9 h-9 rounded bg-slate-100 inline-block" />}
                            <span className="font-medium text-slate-800 line-clamp-2">{p.name || 'Deleted product'}</span>
                          </button>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">{n(p.views)}</td>
                        <td className="py-2 px-2 text-right">{n(p.viewers)}</td>
                        <td className="py-2 px-2 text-right">{n(p.carts)}</td>
                        <td className="py-2 px-2 text-right">{n(p.sold)}</td>
                        <td className="py-2 pl-2 text-right text-slate-500">{pct(Number(p.sold || 0), Number(p.viewers || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-400 mt-2">Many views but few sales? Check the price, pictures and description of that product, or make it a deal.</p>
              </div>
            )}
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card title="Where they came from">
              <Bars total={srcTotal} rows={(data.sources || []).map((r) => ({ name: SOURCE_LABEL[r.name] || r.name, value: Number(r.visitors) }))} />
            </Card>
            <Card title="Cities">
              <Bars total={cityTotal} rows={(data.cities || []).slice(0, 10).map((r) => ({ name: r.name + (r.country && r.country !== 'PK' ? ` (${r.country})` : ''), value: Number(r.visitors) }))} />
            </Card>
            <Card title="Devices">
              <Bars total={devTotal} rows={(data.devices || []).map((r) => ({ name: r.name[0].toUpperCase() + r.name.slice(1), value: Number(r.visitors) }))} />
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="What people searched for" note="add products people look for">
              {(data.searches || []).length === 0 ? <p className="text-sm text-slate-400">No searches yet.</p> : (
                <div className="flex flex-wrap gap-2">
                  {data.searches.map((s) => (
                    <span key={s.query} className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 text-sm border border-violet-100">{s.query} <b>{s.times}</b></span>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Logged-in customers" note="known visitors">
              {(data.customers || []).length === 0 ? <p className="text-sm text-slate-400">No logged-in customer visits yet.</p> : (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {data.customers.map((c) => (
                    <div key={c.user_id} className="py-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-800 truncate">{c.name || c.email}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{ago(c.last_seen)}</span>
                      </div>
                      <div className="text-xs text-slate-500">{c.name ? `${c.email} · ` : ''}{c.city || ''} · {n(c.views)} views · {n(c.carts)} cart · {n(c.orders)} orders</div>
                      {c.viewed && <div className="text-xs text-slate-400 truncate" title={c.viewed}>Viewed: {c.viewed}</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Live activity" note="latest 60">
            {(data.recent || []).length === 0 ? <p className="text-sm text-slate-400">Nothing yet.</p> : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {data.recent.map((r, i) => (
                  <div key={i} className="py-1.5 flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_DOT[r.event] || 'bg-slate-300'}`} />
                    <span className="flex-1 text-slate-700">
                      <b>{r.user_name || r.user_email || 'A visitor'}</b>{r.city ? ` from ${r.city}` : ''} {EVENT_LABEL[r.event] || r.event}
                      {r.product ? <> <i>{r.product}</i></> : null}{r.query ? <> “{r.query}”</> : null}
                      <span className="text-slate-400 text-xs"> · {r.device || ''}{r.source && r.event === 'visit' ? ` · via ${SOURCE_LABEL[r.source] || r.source}` : ''}</span>
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{ago(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Blog articles" note="views in this period · readers · likes · comments">
            {blog === null ? <p className="text-sm text-slate-400">Run supabase_v23.sql once to see blog numbers.</p>
              : blog.length === 0 ? <p className="text-sm text-slate-400">No articles yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-2">Article</th><th className="py-2 px-2 text-right">Views</th><th className="py-2 px-2 text-right">Readers</th>
                    <th className="py-2 px-2 text-right">All-time views</th><th className="py-2 px-2 text-right">Likes</th><th className="py-2 pl-2 text-right">Comments</th>
                  </tr></thead>
                  <tbody>
                    {blog.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2 pr-2"><a href={`/blog/${b.slug}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:underline">{b.title}</a>{!b.published && <span className="ml-1 text-[10px] text-slate-400">(hidden)</span>}</td>
                        <td className="py-2 px-2 text-right font-semibold">{n(b.views)}</td>
                        <td className="py-2 px-2 text-right">{n(b.readers)}</td>
                        <td className="py-2 px-2 text-right">{n(b.views_all)}</td>
                        <td className="py-2 px-2 text-right">♥ {n(b.likes)}</td>
                        <td className="py-2 pl-2 text-right">{n(b.comments)}{Number(b.pending) > 0 && <span className="text-amber-700 text-xs"> (+{b.pending} waiting)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Tips to get more visitors">
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
              <li>Share product links on WhatsApp status and groups: each link shows your logo and counts here as “WhatsApp”.</li>
              <li>Give every product a clear name (brand + product + shade/size) and a full description: Google uses these words.</li>
              <li>Add the products people search for above but you don’t stock yet.</li>
              <li>Register the shop on Google Search Console and Google Business Profile (Karachi), so people find you on Google and Maps.</li>
              <li>When posting on Facebook/Instagram, add <code className="bg-slate-100 px-1 rounded">?utm_source=instagram</code> to the link to see exactly which post brought visitors.</li>
            </ul>
          </Card>
        </>
      )}
      {!data && !error && <p className="text-slate-400">Loading…</p>}
    </div>
  );
}
