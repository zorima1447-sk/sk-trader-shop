// Show prices in the customer's currency. The order itself is always in Rupees (Rs.):
// other currencies are only shown so foreign customers understand the price.
import type { Currency, StoreSettings } from './storeSettings';

const KEY = 'skt_currency';
let active: Currency | null = null; // null = Rupees

export const RUPEE: Currency = { code: 'PKR', symbol: 'Rs.', rate: 1 };

// Which currency a visitor from this country most likely wants
const BY_COUNTRY: Record<string, string> = {
  US: 'USD', AE: 'AED', SA: 'SAR', GB: 'GBP', QA: 'QAR', OM: 'OMR', KW: 'KWD', BH: 'BHD', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  MY: 'MYR', SG: 'SGD', CN: 'CNY', JP: 'JPY', TR: 'TRY', IN: 'INR', BD: 'BDT', ZA: 'ZAR', NO: 'NOK', SE: 'SEK', DK: 'DKK', CH: 'CHF',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
};

export function savedCurrency(): string {
  try { return window.localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function saveCurrency(code: string) {
  try { window.localStorage.setItem(KEY, code); } catch { /* ignore */ }
}
export const currencyForCountry = (iso: string) => BY_COUNTRY[(iso || '').toUpperCase()] || '';

// The currencies a customer can choose, with today's rate when "automatic" is on
export function shopCurrencies(st: StoreSettings, live: Record<string, number> | null): Currency[] {
  if (!st.currencies_enabled) return [];
  const up = 1 + (Number(st.currency_markup) || 0) / 100;
  return st.currencies
    .map((c) => {
      const r = st.currency_auto && live && live[c.code] > 0 ? live[c.code] : c.rate;
      return { ...c, rate: r * up };
    })
    .filter((c) => c.rate > 0);
}

export function setActiveCurrency(c: Currency | null) { active = c && c.code !== 'PKR' ? c : null; }
export const activeCurrency = () => active;

const rupees = (n: number) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');

// Price for customers, in the chosen currency
export function price(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  if (!active) return 'Rs. ' + v.toLocaleString('en-PK');
  const x = v / active.rate;
  const dec = x >= 1000 || ['JPY', 'KWD'].includes(active.code) ? 0 : 2;
  return `${active.symbol}${active.symbol.length > 1 ? ' ' : ''}${x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

// "≈ $12.50" next to an amount that is paid in Rupees; '' when the customer uses Rupees
export const approx = (n: number) => (active ? `≈ ${price(n)}` : '');
export { rupees };
