// Store-wide settings (logo, name, contact details, look & feel, invoice options).
// Stored in the Supabase table "store_settings" (single row with id = 1).

// One item of the scrolling strip under the home page banner.
// icon = a name from src/icons.tsx (for example "truck") or any emoji typed by the admin.
export interface MarqueeItem {
  icon: string;
  text: string;
}

export interface StoreSettings {
  store_name: string;
  header_subtitle: string;
  tagline: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  announcement: string;
  show_announcement: boolean;
  accent: string;
  header_style: 'color' | 'dark' | 'light';
  page_bg: 'gray' | 'white' | 'warm';
  footer_text: string;
  show_trust: boolean;
  show_categories: boolean;
  show_whatsapp_strip: boolean;
  show_marquee: boolean;
  marquee_items: MarqueeItem[];
  marquee_speed: number;
  invoice_header_note: string;
  invoice_footer_note: string;
  invoice_tax_id: string;
  invoice_account_ids: string[];
  invoice_show_logo: boolean;
  invoice_show_accounts: boolean;
  email_invoice_enabled: boolean;
  email_from: string;
  customer_msg_mode: 'off' | 'sms' | 'whatsapp';
  notify_new_product: boolean;
}

export const defaultSettings: StoreSettings = {
  store_name: 'ZORIMA PROFESSIONAL',
  header_subtitle: 'PREMIUM BEAUTY & CARE',
  tagline: 'Original salon-grade hair care & beauty products.',
  logo_url: '',
  phone: '',
  email: '',
  address: '',
  whatsapp: '923000000000',
  facebook: '',
  instagram: '',
  tiktok: '',
  announcement: 'Original Products  |  Cash on Delivery Available  |  Fast Delivery Across Pakistan',
  show_announcement: true,
  accent: 'amber',
  header_style: 'color',
  page_bg: 'gray',
  footer_text: '',
  show_trust: true,
  show_categories: true,
  show_whatsapp_strip: true,
  show_marquee: true,
  marquee_items: [
    { icon: 'flame', text: 'Sale Is Live Now' },
    { icon: 'badge', text: '100% Original Products' },
    { icon: 'truck', text: 'Delivery Across Pakistan' },
    { icon: 'wallet', text: 'Cash on Delivery' }
  ],
  marquee_speed: 30,
  invoice_header_note: '',
  invoice_footer_note: 'Thank you for your business!',
  invoice_tax_id: '',
  invoice_account_ids: [],
  invoice_show_logo: true,
  invoice_show_accounts: true,
  email_invoice_enabled: true,
  email_from: '',
  customer_msg_mode: 'off',
  notify_new_product: false
};

export function mergeSettings(row: any): StoreSettings {
  const out: any = { ...defaultSettings };
  if (row) {
    (Object.keys(defaultSettings) as (keyof StoreSettings)[]).forEach((k) => {
      if (row[k] !== null && row[k] !== undefined) out[k] = row[k];
    });
  }
  if (!Array.isArray(out.invoice_account_ids)) out.invoice_account_ids = [];
  if (!Array.isArray(out.marquee_items)) out.marquee_items = defaultSettings.marquee_items;
  out.marquee_items = out.marquee_items
    .filter((m: any) => m && typeof m.text === 'string')
    .map((m: any) => ({ icon: String(m.icon || ''), text: m.text }));
  if (!['color', 'dark', 'light'].includes(out.header_style)) out.header_style = 'color';
  if (!['gray', 'white', 'warm'].includes(out.page_bg)) out.page_bg = 'gray';
  out.marquee_speed = Number(out.marquee_speed) > 0 ? Number(out.marquee_speed) : 30;
  return out as StoreSettings;
}

export async function fetchStoreSettings(sb: any): Promise<StoreSettings> {
  const { data, error } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.warn('store_settings fetch', error.message);
    return { ...defaultSettings };
  }
  return mergeSettings(data);
}

export const ACCENTS: { key: string; label: string; swatch: string }[] = [
  { key: 'amber', label: 'Gold (default)', swatch: '#f59e0b' },
  { key: 'orange', label: 'Orange', swatch: '#f97316' },
  { key: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { key: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { key: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { key: 'violet', label: 'Violet', swatch: '#8b5cf6' },
  { key: 'red', label: 'Red', swatch: '#ef4444' },
  { key: 'pink', label: 'Pink', swatch: '#ec4899' },
  { key: 'teal', label: 'Teal', swatch: '#14b8a6' },
  { key: 'black', label: 'Black', swatch: '#334155' }
];

// Ready-made themes (Settings > Website Look). Each one only sets the three values below.
export const THEMES: { key: string; label: string; accent: string; header_style: StoreSettings['header_style']; page_bg: StoreSettings['page_bg'] }[] = [
  { key: 'market-orange', label: 'Marketplace Orange', accent: 'orange', header_style: 'color', page_bg: 'gray' },
  { key: 'royal-blue', label: 'Royal Blue', accent: 'blue', header_style: 'color', page_bg: 'gray' },
  { key: 'luxury-gold', label: 'Luxury Gold', accent: 'amber', header_style: 'dark', page_bg: 'warm' },
  { key: 'beauty-pink', label: 'Beauty Pink', accent: 'pink', header_style: 'color', page_bg: 'white' },
  { key: 'fresh-green', label: 'Fresh Green', accent: 'emerald', header_style: 'color', page_bg: 'gray' },
  { key: 'elegant-purple', label: 'Elegant Purple', accent: 'violet', header_style: 'dark', page_bg: 'gray' },
  { key: 'clean-white', label: 'Clean White', accent: 'teal', header_style: 'light', page_bg: 'white' },
  { key: 'classic-black', label: 'Classic Black', accent: 'black', header_style: 'dark', page_bg: 'gray' }
];

const PALETTES: Record<string, Record<number, string>> = {
  orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
  pink: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843' },
  teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
  black: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#64748b', 500: '#475569', 600: '#334155', 700: '#1e293b', 800: '#0f172a', 900: '#020617' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' }
};

// Re-maps the "amber" colour classes used across the site to the chosen accent colour.
export function accentCss(accent: string): string {
  const p = PALETTES[accent];
  if (!p) return '';
  let css = '';
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].forEach((s) => {
    const c = p[s];
    css +=
      `.bg-amber-${s}{background-color:${c}!important}` +
      `.text-amber-${s}{color:${c}!important}` +
      `.border-amber-${s}{border-color:${c}!important}` +
      `.fill-amber-${s}{fill:${c}!important}` +
      `.hover\\:bg-amber-${s}:hover{background-color:${c}!important}` +
      `.hover\\:text-amber-${s}:hover{color:${c}!important}` +
      `.hover\\:border-amber-${s}:hover{border-color:${c}!important}` +
      `.focus\\:border-amber-${s}:focus{border-color:${c}!important}`;
  });
  return css;
}

// ---- Fast start: the last shop data is kept in the browser, so a reload shows the real
// ---- shop at once (instead of the built-in default look) while fresh data loads.
const CACHE_KEY = 'shop_cache_v1';

export function readShopCache(): any | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeShopCache(data: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: try again without the (possibly large) slide images
    try {
      const slim = { ...data, slides: (data.slides || []).filter((s: any) => !String(s.image_url || '').startsWith('data:')) };
      localStorage.setItem(CACHE_KEY, JSON.stringify(slim));
    } catch { /* ignore */ }
  }
}
