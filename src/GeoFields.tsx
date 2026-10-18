import React, { useEffect, useMemo, useState } from 'react';

// Country, province/state, city and phone-country-code picker.
// Data comes from the "country-state-city" package (all countries, states and cities).

export interface GeoValue {
  countryIso: string;
  stateIso: string;
  city: string;
  phoneIso: string;
  phoneNumber: string;
}

export const emptyGeo = (): GeoValue => ({
  countryIso: 'PK',
  stateIso: '',
  city: '',
  phoneIso: 'PK',
  phoneNumber: ''
});

let libPromise: Promise<any> | null = null;

export function loadGeoLib(): Promise<any> {
  if (!libPromise) {
    libPromise = import('country-state-city').then((m: any) => (m.Country ? m : m.default));
  }
  return libPromise;
}

const digits = (v: any) => String(v ?? '').replace(/[^0-9]/g, '');

// Local number without leading zeros: 03001234567 -> 3001234567
export const localNumber = (v: string) => digits(v).replace(/^0+/, '');

export async function resolveGeo(v: GeoValue) {
  const lib = await loadGeoLib();
  const country = lib.Country.getCountryByCode(v.countryIso);
  const state = v.stateIso ? lib.State.getStateByCodeAndCountry(v.stateIso, v.countryIso) : null;
  const phoneCountry = lib.Country.getCountryByCode(v.phoneIso);
  return {
    countryName: (country && country.name) || '',
    stateName: (state && state.name) || '',
    city: v.city || '',
    phoneCode: phoneCountry ? '+' + digits(phoneCountry.phonecode) : ''
  };
}

function useGeoLib() {
  const [lib, setLib] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    loadGeoLib()
      .then((l) => { if (alive) setLib(l); })
      .catch((e) => console.error('country-state-city failed to load', e));
    return () => { alive = false; };
  }, []);
  return lib;
}

interface Props {
  value: GeoValue;
  onChange: (v: GeoValue) => void;
  required?: boolean;
}

const inputCls = 'w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

export function GeoFields({ value, onChange, required = true }: Props) {
  const lib = useGeoLib();

  const countries: any[] = useMemo(() => (lib ? lib.Country.getAllCountries() : []), [lib]);

  const states: any[] = useMemo(
    () => (lib && value.countryIso ? lib.State.getStatesOfCountry(value.countryIso) || [] : []),
    [lib, value.countryIso]
  );

  const cities: any[] = useMemo(() => {
    if (!lib || !value.countryIso) return [];
    if (states.length > 0) {
      return value.stateIso ? lib.City.getCitiesOfState(value.countryIso, value.stateIso) || [] : [];
    }
    return lib.City.getCitiesOfCountry(value.countryIso) || [];
  }, [lib, value.countryIso, value.stateIso, states]);

  if (!lib) {
    return <p className="text-xs text-slate-400">Loading countries...</p>;
  }

  const cityNames: string[] = Array.from(new Set(cities.map((c: any) => c.name as string)));
  if (value.city && !cityNames.includes(value.city)) cityNames.unshift(value.city);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Country {required && '*'}</label>
        <select
          required={required}
          value={value.countryIso}
          onChange={(e) =>
            onChange({ ...value, countryIso: e.target.value, stateIso: '', city: '', phoneIso: e.target.value })
          }
          className={inputCls}
        >
          <option value="">Select country</option>
          {countries.map((c: any) => (
            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {states.length > 0 && (
          <div>
            <label className={labelCls}>Province / State</label>
            <select
              value={value.stateIso}
              onChange={(e) => onChange({ ...value, stateIso: e.target.value, city: '' })}
              className={inputCls}
            >
              <option value="">Select province / state</option>
              {states.map((s: any) => (
                <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className={states.length > 0 ? '' : 'col-span-2'}>
          <label className={labelCls}>City {required && '*'}</label>
          {cityNames.length > 0 ? (
            <select
              required={required}
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              className={inputCls}
            >
              <option value="">Select city</option>
              {cityNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required={required}
              placeholder={states.length > 0 && !value.stateIso ? 'Select province / state first' : 'Type your city'}
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              className={inputCls}
            />
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Mobile Number {required && '*'}</label>
        <div className="flex gap-2">
          <select
            value={value.phoneIso}
            onChange={(e) => onChange({ ...value, phoneIso: e.target.value })}
            className="w-40 px-2 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-amber-500"
            aria-label="Country code"
          >
            {countries.map((c: any) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.isoCode} (+{digits(c.phonecode)}) {c.name}
              </option>
            ))}
          </select>
          <input
            type="tel"
            required={required}
            placeholder="3001234567"
            value={value.phoneNumber}
            onChange={(e) => onChange({ ...value, phoneNumber: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
