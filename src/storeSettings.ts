// Store-wide settings (logo, name, contact details, look & feel, invoice options).
// Stored in the Supabase table "store_settings" (single row with id = 1).

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
  footer_text: string;
  show_trust: boolean;
  show_categories: boolean;
  show_whatsapp_strip: boolean;
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
  footer_text: '',
  show_trust: true,
  show_categories: true,
  show_whatsapp_strip: true,
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
  { key: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { key: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { key: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { key: 'violet', label: 'Violet', swatch: '#8b5cf6' }
];

const PALETTES: Record<string, Record<number, string>> = {
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
      `.focus\\:border-amber-${s}:focus{border-color:${c}!important}`;
  });
  return css;
}
