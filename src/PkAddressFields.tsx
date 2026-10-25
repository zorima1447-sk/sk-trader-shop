import React, { useEffect, useState } from 'react';
import { PkAddress, PROVINCES, citiesOf, areasOf, zipOf, mobileDigits, intlDigits, isPk } from './pakistan';
import { loadGeoLib } from './GeoFields';

// Delivery address. Pakistan: +92 mobile, Province -> City -> Area dropdowns, street address, postal code.
// Other countries: country code, state, city (list or typed), street address, postal code.
type C = { iso: string; name: string; code: string; flag: string };
let countryCache: C[] | null = null;
export function useCountries() {
  const [list, setList] = useState<C[]>(countryCache || []);
  useEffect(() => {
    if (countryCache) return;
    loadGeoLib().then((lib) => {
      countryCache = lib.Country.getAllCountries().map((c: any) => ({
        iso: c.isoCode, name: c.name, flag: c.flag || '',
        code: String(c.phonecode || '').split(/[^0-9+]/)[0].replace(/\D/g, ''),
      })).sort((a: C, b: C) => a.name.localeCompare(b.name));
      setList(countryCache!);
    }).catch(() => {});
  }, []);
  return list;
}

function AbroadFields({ value, onChange, showMobile, note }: { value: PkAddress; onChange: (v: PkAddress) => void; showMobile: boolean; note?: React.ReactNode }) {
  const set = (patch: Partial<PkAddress>) => onChange({ ...value, ...patch });
  const [states, setStates] = useState<{ name: string; iso: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [typedCity, setTypedCity] = useState(false);
  useEffect(() => {
    loadGeoLib().then((lib) => setStates(lib.State.getStatesOfCountry(value.country).map((x: any) => ({ name: x.name, iso: x.isoCode })))).catch(() => setStates([]));
  }, [value.country]);
  useEffect(() => {
    const st = states.find((x) => x.name === value.province);
    if (!st) { setCities([]); return; }
    loadGeoLib().then((lib) => {
      const cs: string[] = lib.City.getCitiesOfState(value.country, st.iso).map((x: any) => x.name);
      setCities(cs);
      setTypedCity(!!value.city && !cs.includes(value.city));
    }).catch(() => setCities([]));
    // eslint-disable-next-line
  }, [value.country, value.province, states]);

  const box = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500';
  const lbl = 'block text-xs font-semibold text-slate-600 mb-1';
  return (
    <div className="space-y-3">
      {showMobile && (
        <div>
          <label className={lbl}>Mobile Number *</label>
          <div className="flex">
            <span className="px-3 flex items-center whitespace-nowrap shrink-0 border border-r-0 border-slate-300 rounded-l-lg bg-slate-100 text-sm font-semibold text-slate-700">+{value.phone_code}</span>
            <input value={value.mobile} onChange={(e) => set({ mobile: intlDigits(e.target.value) })} placeholder="Mobile number" inputMode="numeric" autoComplete="tel-national" className={box + ' rounded-l-none'} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>State / Province / Emirate</label>
          {states.length > 0 ? (
            <select value={value.province} onChange={(e) => set({ province: e.target.value, city: '' })} className={box}>
              <option value="">Select</option>
              {states.map((x) => <option key={x.iso} value={x.name}>{x.name}</option>)}
            </select>
          ) : (
            <input value={value.province} onChange={(e) => set({ province: e.target.value })} placeholder="(optional)" className={box} />
          )}
        </div>
        <div>
          <label className={lbl}>City *</label>
          {cities.length > 0 && !typedCity ? (
            <select value={value.city} onChange={(e) => { if (e.target.value === '__other') { setTypedCity(true); set({ city: '' }); } else set({ city: e.target.value }); }} className={box}>
              <option value="">Select city</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__other">Other city (type it)</option>
            </select>
          ) : (
            <input value={value.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Dubai" className={box} />
          )}
        </div>
      </div>
      {note}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
        <div>
          <label className={lbl}>Address (house / flat no., building, street) *</label>
          <input value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="e.g. Flat 504, Al Noor Tower, Street 12" autoComplete="street-address" className={box} />
        </div>
        <div>
          <label className={lbl}>Postal / ZIP Code</label>
          <input value={value.zip} onChange={(e) => set({ zip: e.target.value.replace(/[^0-9A-Za-z -]/g, '').slice(0, 10) })} placeholder="(if any)" autoComplete="postal-code" className={box} />
        </div>
      </div>
    </div>
  );
}

export function CountrySelect({ value, onChange }: { value: PkAddress; onChange: (v: PkAddress) => void }) {
  const list = useCountries();
  const box = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500';
  const cur = value.country || 'PK';
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">Country *</label>
      <select
        value={cur}
        onChange={(e) => {
          const c = list.find((x) => x.iso === e.target.value);
          if (!c || c.iso === cur) return;
          onChange({ ...value, country: c.iso, country_name: c.name, phone_code: c.code || '', province: '', city: '', area: '', zip: '', mobile: '' });
        }}
        className={box}
      >
        <option value="PK">🇵🇰 Pakistan</option>
        {list.length === 0 && cur !== 'PK' && <option value={cur}>{value.country_name || cur}</option>}
        {list.length > 0 && <option disabled>──────────</option>}
        {list.filter((c) => c.iso !== 'PK').map((c) => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
      </select>
    </div>
  );
}
export default function PkAddressFields({
  value,
  onChange,
  showMobile = true,
  note
}: {
  value: PkAddress;
  onChange: (v: PkAddress) => void;
  showMobile?: boolean;
  note?: React.ReactNode; // e.g. the delivery charge for the chosen city
}) {
  if (!isPk(value)) {
    return (
      <div className="space-y-3">
        <CountrySelect value={value} onChange={onChange} />
        <AbroadFields value={value} onChange={onChange} showMobile={showMobile} note={note} />
      </div>
    );
  }
  return <PkFields value={value} onChange={onChange} showMobile={showMobile} note={note} />;
}

function PkFields({ value, onChange, showMobile, note }: { value: PkAddress; onChange: (v: PkAddress) => void; showMobile: boolean; note?: React.ReactNode }) {
  const areas = value.province && value.city ? areasOf(value.province, value.city) : [];
  const [other, setOther] = useState(!!value.area && !areas.includes(value.area));
  const set = (patch: Partial<PkAddress>) => onChange({ ...value, ...patch });

  const box = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-400';
  const lbl = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="space-y-3">
      <CountrySelect value={value} onChange={onChange} />
      {showMobile && (
        <div>
          <label className={lbl}>Mobile Number *</label>
          <div className="flex">
            <span className="px-3 flex items-center whitespace-nowrap shrink-0 border border-r-0 border-slate-300 rounded-l-lg bg-slate-100 text-sm font-semibold text-slate-700">+92</span>
            <input
              value={value.mobile}
              onChange={(e) => set({ mobile: mobileDigits(e.target.value) })}
              placeholder="3XX XXXXXXX"
              inputMode="numeric"
              autoComplete="tel-national"
              className={box + ' rounded-l-none'}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Province *</label>
          <select
            value={value.province}
            onChange={(e) => { setOther(false); set({ province: e.target.value, city: '', area: '', zip: '' }); }}
            className={box}
          >
            <option value="">Select province</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>City *</label>
          <select
            value={value.city}
            disabled={!value.province}
            onChange={(e) => { setOther(false); set({ city: e.target.value, area: '', zip: zipOf(value.province, e.target.value) }); }}
            className={box}
          >
            <option value="">{value.province ? 'Select city' : 'Select province first'}</option>
            {citiesOf(value.province).map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Area *</label>
          <select
            value={other ? '__other' : value.area}
            disabled={!value.city}
            onChange={(e) => {
              if (e.target.value === '__other') { setOther(true); set({ area: '' }); }
              else { setOther(false); set({ area: e.target.value }); }
            }}
            className={box}
          >
            <option value="">{value.city ? 'Select area' : 'Select city first'}</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
            <option value="__other">Other area (type it)</option>
          </select>
        </div>
      </div>

      {other && (
        <div>
          <label className={lbl}>Your area / town *</label>
          <input value={value.area} onChange={(e) => set({ area: e.target.value })} placeholder="e.g. Model Colony" className={box} />
        </div>
      )}

      {note}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
        <div>
          <label className={lbl}>Address (house / shop no., street) *</label>
          <input value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="e.g. House 12, Street 4, Block B" autoComplete="street-address" className={box} />
        </div>
        <div>
          <label className={lbl}>Postal / ZIP Code *</label>
          <input
            value={value.zip}
            onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
            placeholder="e.g. 75500"
            inputMode="numeric"
            autoComplete="postal-code"
            className={box}
          />
        </div>
      </div>
    </div>
  );
}
