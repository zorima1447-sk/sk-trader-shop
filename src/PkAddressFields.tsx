import React, { useState } from 'react';
import { PkAddress, PROVINCES, citiesOf, areasOf, zipOf, mobileDigits } from './pakistan';

// Pakistan-only address: +92 mobile, Province -> City -> Area dropdowns, street address, postal code.
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
  const areas = value.province && value.city ? areasOf(value.province, value.city) : [];
  const [other, setOther] = useState(!!value.area && !areas.includes(value.area));
  const set = (patch: Partial<PkAddress>) => onChange({ ...value, ...patch });

  const box = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-400';
  const lbl = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="space-y-3">
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
