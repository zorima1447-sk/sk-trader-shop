// Vercel function: today's exchange rates (how many Rupees for 1 USD, AED, ...) and the
// visitor's country, so the shop can show prices in his currency. Cached for 6 hours.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const country = req.headers.get('x-vercel-ip-country') || '';
  let rates = {};
  let updated = '';
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/PKR');
    if (r.ok) {
      const j = await r.json();
      if (j && j.result === 'success' && j.rates) {
        for (const [code, v] of Object.entries(j.rates)) {
          const n = Number(v);
          if (n > 0 && code !== 'PKR') rates[code] = Math.round((1 / n) * 10000) / 10000; // Rs. for 1 unit
        }
        updated = j.time_last_update_utc || '';
      }
    }
  } catch { /* the shop then uses the rates saved in Admin */ }
  return new Response(JSON.stringify({ country, updated, rates }), {
    headers: {
      'Content-Type': 'application/json',
      // the rates are the same for everybody, the country is not: cache in the browser only
      'Cache-Control': 'private, max-age=21600',
    },
  });
}
