// Visitor tracking for Admin > Visitors Report.
// Sends small events to /api/track (Vercel adds the city). Never blocks or breaks the shop.
import { supabase, getAdminToken } from './supabaseClient';

type Ev = 'visit' | 'product_view' | 'add_to_cart' | 'search' | 'checkout' | 'order' | 'post_view';

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function store(kind: 'local' | 'session', key: string): string {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    let v = s.getItem(key);
    if (!v) { v = rid(); s.setItem(key, v); }
    return v;
  } catch { return 'na-' + rid(); }
}

function device(): string {
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

let firstSource: string | null = null;
function source(): string {
  if (firstSource) return firstSource;
  let s = 'direct';
  try {
    const q = new URLSearchParams(window.location.search);
    const utm = (q.get('utm_source') || q.get('src') || '').toLowerCase();
    const ref = (document.referrer || '').toLowerCase();
    const mine = ref && ref.includes(window.location.hostname);
    const hay = utm || (mine ? '' : ref);
    if (q.get('fbclid')) s = 'facebook';
    else if (q.get('gclid')) s = 'google';
    else if (hay) {
      s = /whatsapp|wa\.me/.test(hay) ? 'whatsapp'
        : /facebook|fb\.|messenger/.test(hay) ? 'facebook'
        : /instagram/.test(hay) ? 'instagram'
        : /google/.test(hay) ? 'google'
        : /tiktok/.test(hay) ? 'tiktok'
        : /youtube|youtu\.be/.test(hay) ? 'youtube'
        : /bing|yahoo|duckduckgo/.test(hay) ? 'search'
        : utm ? utm.slice(0, 20) : 'other';
    }
  } catch { /* direct */ }
  firstSource = s;
  return s;
}

const isLocal = () => /^(localhost|127\.|192\.168\.)/.test(window.location.hostname) || window.location.protocol === 'file:';

export async function track(event: Ev, extra: { product_id?: string; query?: string } = {}) {
  try {
    if (isLocal() || getAdminToken()) return; // don't count the shop owner / testing
    let token = '';
    try { token = (await supabase.auth.getSession()).data.session?.access_token || ''; } catch { /* guest */ }
    const body = {
      event,
      visitor_id: store('local', 'skt_vid'),
      session_id: store('session', 'skt_sid'),
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || '',
      source: source(),
      device: device(),
      token,
      ...extra,
    };
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

// searches: only count what the visitor finally typed (after a pause)
let searchTimer: any = null;
let lastSearch = '';
// one random id per browser (also used for blog likes)
export const visitorId = () => store('local', 'skt_vid');

export function trackSearch(q: string) {
  clearTimeout(searchTimer);
  const t = (q || '').trim();
  if (t.length < 2) return;
  searchTimer = setTimeout(() => {
    if (t.toLowerCase() === lastSearch) return;
    lastSearch = t.toLowerCase();
    track('search', { query: t });
  }, 1500);
}
