// Store-wide settings (logo, name, contact details, look & feel, invoice options).
// Stored in the Supabase table "store_settings" (single row with id = 1).

// One item of the scrolling strip under the home page banner.
// icon = a name from src/icons.tsx (for example "truck") or any emoji typed by the admin.
export interface MarqueeItem {
  icon: string;
  text: string;
}

// One brand card in the "Our Brands" section of the home page.
// keyword = what is searched when a shopper taps the brand (empty = the brand name).
export interface Brand {
  name: string;
  logo_url: string;
  keyword: string;
  remove_bg: boolean;              // take away the plain background around the logo
  tone: 'original' | 'dark' | 'light'; // show the logo in its own colours, all dark or all white
}

// A box in the "trust badges" row (Settings > Home Page Content)
export interface TrustItem {
  icon: string;
  title: string;
  text: string;
}

// An extra link in the footer
export interface FooterLink {
  label: string;
  url: string;
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
  delivery_karachi: number;    // delivery charge inside Karachi (0 = free)
  delivery_other: number;      // delivery charge when a province has no own charge
  delivery_rates: Record<string, number>; // delivery charge per province, e.g. { "Punjab": 250 }
  free_delivery_over: number;  // order amount from which delivery is free (0 = never)
  cod_karachi_only: boolean;   // Cash on Delivery only for Karachi; other cities must pay online
  invoice_prefix: string;      // order numbers look like SK-261022-1005
  gst_enabled: boolean;        // charge / show sales tax (GST) on invoices
  gst_rate: number;            // e.g. 18
  gst_inclusive: boolean;      // true = product prices already include GST
  strn: string;                // Sales Tax Registration Number (FBR)
  ai_chat_enabled: boolean;    // show the AI chat button to shoppers
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
  font_family: string;         // key from FONTS below
  font_scale: number;          // text size in %, 100 = normal
  heading_font: string;        // font for headings + shop name ('same' = same as the main font)
  header_color: string;        // '' = from the header style, or any "#rrggbb"
  page_bg_color: string;       // '' = from the page background choice
  strip_color: string;         // scrolling strip background ('' = theme colour)
  strip_text_color: string;
  topbar_color: string;        // thin announcement bar at the very top
  topbar_text_color: string;
  footer_color: string;
  search_shape: 'square' | 'rounded' | 'pill';
  search_button: 'auto' | 'accent' | 'dark' | 'light';
  search_size: 'normal' | 'large';
  search_placeholder: string;  // empty = "Search in <store name>"
  categories_title: string;
  show_brands: boolean;
  brands_title: string;
  brands: Brand[];
  brands_slide: boolean;       // logos keep sliding
  brands_speed: number;        // seconds for one round
  show_flash: boolean;
  flash_title: string;
  flash_badge: string;
  products_title: string;
  trust_items: TrustItem[];
  wa_title: string;
  wa_text: string;
  wa_button: string;
  wa_message: string;
  footer_links: FooterLink[];
  footer_show_categories: boolean;
  footer_show_payments: boolean;
  quick_links_title: string;
  payments_title: string;
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
  delivery_karachi: 0,
  delivery_other: 250,
  delivery_rates: {},
  free_delivery_over: 0,
  cod_karachi_only: true,
  invoice_prefix: 'SK',
  gst_enabled: false,
  gst_rate: 18,
  gst_inclusive: true,
  strn: '',
  ai_chat_enabled: false,
  invoice_header_note: '',
  invoice_footer_note: 'Thank you for your business!',
  invoice_tax_id: '',
  invoice_account_ids: [],
  invoice_show_logo: true,
  invoice_show_accounts: true,
  email_invoice_enabled: true,
  email_from: '',
  customer_msg_mode: 'off',
  notify_new_product: false,
  font_family: 'system',
  font_scale: 100,
  heading_font: 'same',
  header_color: '',
  page_bg_color: '',
  strip_color: '',
  strip_text_color: '',
  topbar_color: '',
  topbar_text_color: '',
  footer_color: '',
  search_shape: 'rounded',
  search_button: 'auto',
  search_size: 'normal',
  search_placeholder: '',
  categories_title: 'Shop by Category',
  show_brands: true,
  brands_title: 'Our Brands',
  brands: [
    { name: 'Freecia Professional', logo_url: '', keyword: 'Freecia', remove_bg: true, tone: 'original' },
    { name: 'Signature Professional', logo_url: '', keyword: 'Signature', remove_bg: true, tone: 'original' },
    { name: 'Saffron', logo_url: '', keyword: 'Saffron', remove_bg: true, tone: 'original' }
  ],
  brands_slide: true,
  brands_speed: 25,
  show_flash: true,
  flash_title: 'Flash Sale',
  flash_badge: 'On Sale Now',
  products_title: 'Just For You',
  trust_items: [
    { icon: 'badge', title: '100% Original', text: 'Authentic salon-grade products.' },
    { icon: 'truck', title: 'Fast Delivery', text: 'Delivered across Pakistan.' },
    { icon: 'shield', title: 'Cash on Delivery', text: 'Pay when you receive your order.' },
    { icon: 'chat', title: 'WhatsApp Support', text: 'Ask us anything, anytime.' }
  ],
  wa_title: 'Need help choosing a product?',
  wa_text: 'Message us on WhatsApp and we will help you.',
  wa_button: 'Chat on WhatsApp',
  wa_message: 'Hello, I would like some information about your products.',
  footer_links: [],
  footer_show_categories: true,
  footer_show_payments: true,
  quick_links_title: 'Quick Links',
  payments_title: 'Payment Options'
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
  out.delivery_karachi = Math.max(0, Number(out.delivery_karachi) || 0);
  out.delivery_other = Math.max(0, Number(out.delivery_other) || 0);
  out.free_delivery_over = Math.max(0, Number(out.free_delivery_over) || 0);
  out.gst_rate = Math.max(0, Number(out.gst_rate) || 0);
  if (!FONTS.some((x) => x.key === out.font_family && !x.display)) out.font_family = 'system';
  if (out.heading_font !== 'same' && !FONTS.some((x) => x.key === out.heading_font)) out.heading_font = 'same';
  (['header_color', 'page_bg_color', 'strip_color', 'strip_text_color', 'topbar_color', 'topbar_text_color', 'footer_color'] as const).forEach((k) => {
    out[k] = isHex(out[k]) ? String(out[k]).toLowerCase() : '';
  });
  out.font_scale = Math.min(160, Math.max(70, Number(out.font_scale) || 100));
  if (!['square', 'rounded', 'pill'].includes(out.search_shape)) out.search_shape = 'rounded';
  if (!['auto', 'accent', 'dark', 'light'].includes(out.search_button)) out.search_button = 'auto';
  if (!['normal', 'large'].includes(out.search_size)) out.search_size = 'normal';
  if (!Array.isArray(out.brands)) out.brands = defaultSettings.brands;
  out.brands = out.brands
    .filter((b: any) => b && typeof b.name === 'string')
    .map((b: any) => ({
      name: b.name,
      logo_url: String(b.logo_url || ''),
      keyword: String(b.keyword || ''),
      remove_bg: b.remove_bg !== false,
      tone: ['original', 'dark', 'light'].includes(b.tone) ? b.tone : 'original'
    }));
  out.brands_speed = Math.min(120, Math.max(5, Number(out.brands_speed) || 25));
  if (!Array.isArray(out.trust_items)) out.trust_items = defaultSettings.trust_items;
  out.trust_items = out.trust_items.filter((t: any) => t && typeof t.title === 'string')
    .map((t: any) => ({ icon: String(t.icon || ''), title: t.title, text: String(t.text || '') }));
  if (!Array.isArray(out.footer_links)) out.footer_links = [];
  out.footer_links = out.footer_links.filter((l: any) => l && typeof l.label === 'string')
    .map((l: any) => ({ label: l.label, url: String(l.url || '') }));
  if (!out.delivery_rates || typeof out.delivery_rates !== 'object' || Array.isArray(out.delivery_rates)) out.delivery_rates = {};
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

export const isHex = (v: any) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

// true when a colour is light (then dark text is used on it)
export function isLightColor(hex: string): boolean {
  if (!isHex(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// Fonts the admin can pick (Settings > Store Profile). Google Fonts are loaded only when chosen.
// display = decorative font, offered for headings only. w = font weights that exist for that font.
export type FontDef = { key: string; label: string; family: string; google?: string; w?: string; group: string; display?: boolean };
export const FONTS: FontDef[] = [
  { key: 'system', label: 'Default (phone / computer font)', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", group: 'Simple & clean' },
  { key: 'inter', label: 'Inter', family: "'Inter', sans-serif", google: 'Inter', group: 'Simple & clean' },
  { key: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif", google: 'Roboto', group: 'Simple & clean' },
  { key: 'open-sans', label: 'Open Sans', family: "'Open Sans', sans-serif", google: 'Open Sans', group: 'Simple & clean' },
  { key: 'lato', label: 'Lato', family: "'Lato', sans-serif", google: 'Lato', w: '400;700;900', group: 'Simple & clean' },
  { key: 'work-sans', label: 'Work Sans', family: "'Work Sans', sans-serif", google: 'Work Sans', group: 'Simple & clean' },
  { key: 'mulish', label: 'Mulish', family: "'Mulish', sans-serif", google: 'Mulish', group: 'Simple & clean' },
  { key: 'ubuntu', label: 'Ubuntu', family: "'Ubuntu', sans-serif", google: 'Ubuntu', w: '400;500;700', group: 'Simple & clean' },
  { key: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", google: 'Poppins', group: 'Modern' },
  { key: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif", google: 'Montserrat', group: 'Modern' },
  { key: 'outfit', label: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit', group: 'Modern' },
  { key: 'dm-sans', label: 'DM Sans', family: "'DM Sans', sans-serif", google: 'DM Sans', group: 'Modern' },
  { key: 'manrope', label: 'Manrope', family: "'Manrope', sans-serif", google: 'Manrope', group: 'Modern' },
  { key: 'rubik', label: 'Rubik', family: "'Rubik', sans-serif", google: 'Rubik', group: 'Modern' },
  { key: 'barlow', label: 'Barlow', family: "'Barlow', sans-serif", google: 'Barlow', group: 'Modern' },
  { key: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif", google: 'Raleway', group: 'Modern' },
  { key: 'oswald', label: 'Oswald (tall, bold)', family: "'Oswald', sans-serif", google: 'Oswald', w: '400;500;600;700', group: 'Modern' },
  { key: 'nunito', label: 'Nunito', family: "'Nunito', sans-serif", google: 'Nunito', group: 'Soft & friendly' },
  { key: 'quicksand', label: 'Quicksand', family: "'Quicksand', sans-serif", google: 'Quicksand', w: '400;500;600;700', group: 'Soft & friendly' },
  { key: 'comfortaa', label: 'Comfortaa', family: "'Comfortaa', sans-serif", google: 'Comfortaa', w: '400;700', group: 'Soft & friendly' },
  { key: 'josefin', label: 'Josefin Sans', family: "'Josefin Sans', sans-serif", google: 'Josefin Sans', w: '400;500;600;700', group: 'Soft & friendly' },
  { key: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif", google: 'Playfair Display', group: 'Elegant & luxury' },
  { key: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif", google: 'Cormorant Garamond', w: '400;500;600;700', group: 'Elegant & luxury' },
  { key: 'eb-garamond', label: 'EB Garamond', family: "'EB Garamond', serif", google: 'EB Garamond', group: 'Elegant & luxury' },
  { key: 'lora', label: 'Lora', family: "'Lora', serif", google: 'Lora', w: '400;500;600;700', group: 'Elegant & luxury' },
  { key: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif", google: 'Merriweather', w: '400;700', group: 'Elegant & luxury' },
  { key: 'libre-baskerville', label: 'Libre Baskerville', family: "'Libre Baskerville', serif", google: 'Libre Baskerville', w: '400;700', group: 'Elegant & luxury' },
  { key: 'cinzel', label: 'Cinzel (royal capitals)', family: "'Cinzel', serif", google: 'Cinzel', group: 'Elegant & luxury' },
  { key: 'urdu', label: 'Noto Nastaliq Urdu (اردو)', family: "'Noto Nastaliq Urdu', serif", google: 'Noto Nastaliq Urdu', w: '400;700', group: 'Urdu' },
  { key: 'marcellus', label: 'Marcellus', family: "'Marcellus', serif", google: 'Marcellus', w: '400', group: 'Headings only', display: true },
  { key: 'abril', label: 'Abril Fatface', family: "'Abril Fatface', serif", google: 'Abril Fatface', w: '400', group: 'Headings only', display: true },
  { key: 'bebas', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif", google: 'Bebas Neue', w: '400', group: 'Headings only', display: true },
  { key: 'dancing', label: 'Dancing Script (handwriting)', family: "'Dancing Script', cursive", google: 'Dancing Script', w: '400;700', group: 'Headings only', display: true },
  { key: 'great-vibes', label: 'Great Vibes (signature)', family: "'Great Vibes', cursive", google: 'Great Vibes', w: '400', group: 'Headings only', display: true },
  { key: 'pacifico', label: 'Pacifico', family: "'Pacifico', cursive", google: 'Pacifico', w: '400', group: 'Headings only', display: true }
];

export const FONT_SIZES: { value: number; label: string }[] = [
  { value: 85, label: 'Small' },
  { value: 100, label: 'Normal' },
  { value: 110, label: 'Large' },
  { value: 120, label: 'Extra large' },
  { value: 135, label: 'Very large' },
  { value: 150, label: 'Huge' }
];

// Google Fonts link for one or more fonts from the list above
export function googleFontUrl(fonts: FontDef[]): string {
  const fams = fonts.filter((f) => f.google).map((f) => 'family=' + (f.google as string).replace(/ /g, '+') + ':wght@' + (f.w || '400;500;600;700;800')).join('&');
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}

// CSS for the chosen font and text size (put inside a <style> tag)
export function fontCss(st: Pick<StoreSettings, 'font_family' | 'font_scale' | 'heading_font'>): string {
  let css = '';
  const f = FONTS.find((x) => x.key === st.font_family);
  const h = st.heading_font && st.heading_font !== 'same' ? FONTS.find((x) => x.key === st.heading_font) : undefined;
  const load = [f, h].filter((x): x is FontDef => !!(x && x.google));
  if (load.length) css += `@import url('${googleFontUrl(load)}');`;
  if (f && f.google) css += `.site-font,.site-font *{font-family:${f.family}!important}`;
  if (h) css += `.site-font h1,.site-font h2,.site-font .site-heading{font-family:${h.family}!important}`;
  if (st.font_scale && st.font_scale !== 100) css += `html{font-size:${st.font_scale}%}`;
  return css;
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
  { key: 'black', label: 'Black', swatch: '#334155' },
  { key: '#4f46e5', label: 'Indigo', swatch: '#4f46e5' },
  { key: '#0891b2', label: 'Cyan', swatch: '#0891b2' },
  { key: '#0284c7', label: 'Sky', swatch: '#0284c7' },
  { key: '#1e3a8a', label: 'Navy', swatch: '#1e3a8a' },
  { key: '#9333ea', label: 'Purple', swatch: '#9333ea' },
  { key: '#c026d3', label: 'Magenta', swatch: '#c026d3' },
  { key: '#be123c', label: 'Crimson', swatch: '#be123c' },
  { key: '#7f1d1d', label: 'Maroon', swatch: '#7f1d1d' },
  { key: '#65a30d', label: 'Lime green', swatch: '#65a30d' },
  { key: '#166534', label: 'Dark green', swatch: '#166534' },
  { key: '#ca8a04', label: 'Mustard', swatch: '#ca8a04' },
  { key: '#b45309', label: 'Bronze', swatch: '#b45309' },
  { key: '#78350f', label: 'Brown', swatch: '#78350f' },
  { key: '#a16207', label: 'Gold', swatch: '#a16207' },
  { key: '#db2777', label: 'Hot pink', swatch: '#db2777' },
  { key: '#e11d48', label: 'Ruby', swatch: '#e11d48' }
];

// Colour shown for an accent key (preset name or any "#rrggbb" colour)
export function accentSwatch(key: string): string {
  if (/^#[0-9a-f]{6}$/i.test(key || '')) return key;
  return (ACCENTS.find((a) => a.key === key) || ACCENTS[0]).swatch;
}

// Builds 50..900 shades from any colour (600 = the colour itself)
function paletteFromHex(hex: string): Record<number, string> {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = (target: number, amt: number) => '#' + rgb.map((c) => Math.round(c + (target - c) * amt).toString(16).padStart(2, '0')).join('');
  return {
    50: mix(255, 0.93), 100: mix(255, 0.85), 200: mix(255, 0.7), 300: mix(255, 0.5), 400: mix(255, 0.28),
    500: mix(255, 0.12), 600: hex, 700: mix(0, 0.15), 800: mix(0, 0.3), 900: mix(0, 0.45)
  };
}

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
  const p = /^#[0-9a-f]{6}$/i.test(accent || '') ? paletteFromHex(accent) : PALETTES[accent];
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
      `.focus\\:border-amber-${s}:focus{border-color:${c}!important}` +
      `.ring-amber-${s}{--tw-ring-color:${c}!important}` +
      `.accent-amber-${s}{accent-color:${c}!important}`;
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

// Delivery charge for an order (the database calculates the same in place_order)
// Karachi city has its own charge; every other city uses its province's charge (or the default one).
export function deliveryChargeFor(st: StoreSettings, province: string, city: string, subtotal: number): number {
  if (!city) return 0;
  if (st.free_delivery_over > 0 && subtotal >= st.free_delivery_over) return 0;
  if (city.trim().toLowerCase() === 'karachi') return st.delivery_karachi;
  const r = st.delivery_rates ? st.delivery_rates[province] : undefined;
  return r !== undefined && r !== null && !isNaN(Number(r)) ? Number(r) : st.delivery_other;
}

// Sales tax (GST) on the goods amount. inclusive = prices already contain the tax.
export function gstFor(st: StoreSettings, goods: number): { rate: number; amount: number; inclusive: boolean } {
  if (!st.gst_enabled || !(st.gst_rate > 0)) return { rate: 0, amount: 0, inclusive: true };
  const r = st.gst_rate;
  const amount = st.gst_inclusive ? goods * r / (100 + r) : goods * r / 100;
  return { rate: r, amount: Math.round(amount * 100) / 100, inclusive: st.gst_inclusive };
}
