import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabaseClient';
import { Eye, EyeOff, Package, User, LogOut, FileText, Lock } from 'lucide-react';
import PkAddressFields from './PkAddressFields';
import { TrackTimeline } from './Tracking';
import { PkAddress, emptyPkAddress, checkPkAddress, mobileDigits, fullPhoneDigits, intlDigits } from './pakistan';

// The saved address of a customer (user_metadata) as a form value
export const addressFromMeta = (m: any): PkAddress => {
  const abroad = !!m.country && m.country !== 'PK';
  const code = abroad ? String(m.phone_code || '') : '92';
  const phone = String(m.phone || '').replace(/\D/g, '');
  return {
  country: abroad ? m.country : 'PK',
  country_name: abroad ? (m.country_name || m.country) : 'Pakistan',
  phone_code: code,
  province: m.province || '',
  city: m.city || '',
  area: m.area || '',
  address: m.address || '',
  zip: m.zip || '',
  mobile: abroad ? intlDigits(phone.startsWith(code) ? phone.slice(code.length) : phone) : mobileDigits(m.phone || '')
  };
};

// What is saved in the customer's account for his address
const addrMeta = (a: PkAddress) => ({
  phone: fullPhoneDigits(a), country: a.country || 'PK', country_name: a.country_name || 'Pakistan', phone_code: a.phone_code || '92',
  province: a.province, city: a.city.trim(), area: a.area.trim(), address: a.address.trim(), zip: a.zip.trim()
});

// Customer accounts (Supabase Auth): Login / Register / Forgot password / New password, and "My Account".
// Name and phone are kept in the account's user_metadata.

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const box = 'w-full px-4 py-3 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:border-amber-500';
const lbl = 'block text-sm text-slate-700 mb-1.5';

const money = (n: number | string | null | undefined) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');

export const phoneDigits = (p: string) => {
  const d = (p || '').replace(/\D/g, '');
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.length === 10 && d.startsWith('3')) return '92' + d;
  return d;
};

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={box + ' pr-11'}
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

export function AuthPage({ storeName, mode, setMode, onDone, notice = '', onBack }: { storeName: string; mode: AuthMode; setMode: (m: AuthMode) => void; onDone: () => void; notice?: string; onBack?: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [name, setName] = useState('');
  const [addr, setAddr] = useState<PkAddress>(emptyPkAddress());
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Which social logins are switched on in Supabase (Authentication > Providers). Only those buttons are shown.
  const [providers, setProviders] = useState<{ google: boolean; facebook: boolean }>({ google: false, facebook: false });

  useEffect(() => {
    fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        const ext = (cfg && cfg.external) || {};
        setProviders({ google: !!ext.google, facebook: !!ext.facebook });
      })
      .catch(() => { /* keep both hidden */ });
  }, []);

  useEffect(() => { setError(''); setInfo(''); }, [mode]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setInfo('');
    try { await fn(); } catch (e: any) { setError(e.message || String(e)); } finally { setBusy(false); }
  };

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!login.trim() || !password) throw new Error('Please enter your phone number or email and your password.');
      if (login.includes('@')) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: login.trim(), password });
        if (err) throw new Error(/confirm/i.test(err.message) ? 'Please confirm your email first (check your inbox).' : 'Wrong phone number / email or password.');
      } else {
        const { data, error: err } = await supabase.functions.invoke('customer-login', { body: { login: login.trim(), password } });
        if (err) throw new Error('Login with phone number is not available right now. Please use your email.');
        if (!data || data.error) throw new Error((data && data.error) || 'Wrong phone number / email or password.');
        const { error: e2 } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
        if (e2) throw e2;
      }
      onDone();
    });
  };

  const doRegister = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!name.trim()) throw new Error('Please enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Please enter a valid email address.');
      const bad = checkPkAddress(addr);
      if (bad) throw new Error(bad);
      const pd = fullPhoneDigits(addr);
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== password2) throw new Error('The two passwords are not the same.');
      const { data: taken } = await supabase.rpc('phone_registered', { p_phone: pd });
      if (taken) throw new Error('This mobile number is already registered. Please log in.');
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), ...addrMeta(addr) },
          emailRedirectTo: window.location.origin
        }
      });
      if (err) throw new Error(/registered|exists/i.test(err.message) ? 'This email is already registered. Please log in.' : err.message);
      if (data.session) { onDone(); return; }
      setInfo(`Almost done! We sent a confirmation link to ${email.trim()}. Open it, then log in.`);
      setMode('login');
      setLogin(email.trim());
    });
  };

  const doForgot = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Please enter the email of your account.');
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (err) throw err;
      setInfo(`If an account exists for ${email.trim()}, we have sent a link to set a new password.`);
    });
  };

  const doReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== password2) throw new Error('The two passwords are not the same.');
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      alert('Your new password is saved.');
      onDone();
    });
  };

  const social = (provider: 'google' | 'facebook') =>
    run(async () => {
      const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (err) throw new Error(/not enabled|provider/i.test(err.message) ? `${provider === 'google' ? 'Google' : 'Facebook'} login is not switched on yet. Please use phone / email.` : err.message);
    });

  const title = {
    login: `Welcome to ${storeName}! Please login.`,
    register: 'Create your account',
    forgot: 'Forgot your password?',
    reset: 'Set a new password'
  }[mode];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      {onBack && (
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline cursor-pointer">
          ← Back to Shop
        </button>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-4">
        <h1 className="text-xl sm:text-2xl text-slate-800">{title}</h1>
        {mode === 'login' && (
          <p className="text-sm text-slate-500">New member? <button onClick={() => setMode('register')} className="text-sky-600 hover:underline cursor-pointer">Register</button> here.</p>
        )}
        {mode === 'register' && (
          <p className="text-sm text-slate-500">Already member? <button onClick={() => setMode('login')} className="text-sky-600 hover:underline cursor-pointer">Login</button> here.</p>
        )}
      </div>

      <div className="bg-white shadow-sm px-4 sm:px-12 py-8">
        <div className="max-w-md mx-auto">
          {notice && (mode === 'login' || mode === 'register') && (
            <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {notice} New here? <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="underline font-semibold cursor-pointer">{mode === 'login' ? 'Create an account' : 'I already have an account'}</button>
            </p>
          )}
          {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          {info && <p className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{info}</p>}

          {mode === 'login' && (
            <form onSubmit={doLogin} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800">Login with Password</h2>
              <div>
                <label className={lbl}>Phone Number or Email*</label>
                <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Please enter your Phone Number or Email" autoComplete="username" className={box} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm text-slate-700">Password*</label>
                  <button type="button" onClick={() => setMode('forgot')} className="text-sm text-sky-600 hover:underline cursor-pointer">Forgot Password?</button>
                </div>
                <PasswordInput value={password} onChange={setPassword} placeholder="Please enter your password" autoComplete="current-password" />
              </div>
              <button disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded text-sm tracking-wide cursor-pointer disabled:opacity-60">
                {busy ? 'PLEASE WAIT...' : 'LOGIN'}
              </button>
              {(providers.google || providers.facebook) && (
              <>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span className="flex-1 h-px bg-slate-200" /> Or, login with <span className="flex-1 h-px bg-slate-200" />
              </div>
              <div className={`grid gap-3 ${providers.google && providers.facebook ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {providers.facebook && (
                <button type="button" onClick={() => social('facebook')} className="border border-slate-300 rounded py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer">
                  <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center">f</span> Facebook
                </button>
                )}
                {providers.google && (
                <button type="button" onClick={() => social('google')} className="border border-slate-300 rounded py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer">
                  <span className="w-5 h-5 rounded-full border text-xs font-bold flex items-center justify-center text-[#4285F4]">G</span> Google
                </button>
                )}
              </div>
              </>
              )}
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={doRegister} className="space-y-4">
              <div>
                <label className={lbl}>Full Name*</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" autoComplete="name" className={box} />
              </div>
              <div>
                <label className={lbl}>Email*</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" type="email" autoComplete="email" className={box} />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-800 mb-3">Delivery address</p>
                <PkAddressFields value={addr} onChange={setAddr} />
              </div>
              <div>
                <label className={lbl}>Password* (at least 6 characters)</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="Create a password" autoComplete="new-password" />
              </div>
              <div>
                <label className={lbl}>Confirm Password*</label>
                <PasswordInput value={password2} onChange={setPassword2} placeholder="Type the password again" autoComplete="new-password" />
              </div>
              <button disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded text-sm tracking-wide cursor-pointer disabled:opacity-60">
                {busy ? 'PLEASE WAIT...' : 'SIGN UP'}
              </button>
              <p className="text-[11px] text-slate-500 text-center">You can log in later with your phone number or your email.</p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={doForgot} className="space-y-5">
              <p className="text-sm text-slate-600">Enter the email of your account. We will send you a link to set a new password.</p>
              <div>
                <label className={lbl}>Email*</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" type="email" className={box} />
              </div>
              <button disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded text-sm cursor-pointer disabled:opacity-60">
                {busy ? 'PLEASE WAIT...' : 'SEND LINK'}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-sm text-sky-600 hover:underline cursor-pointer">Back to login</button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={doReset} className="space-y-5">
              <div>
                <label className={lbl}>New Password*</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className={lbl}>Confirm New Password*</label>
                <PasswordInput value={password2} onChange={setPassword2} placeholder="Type it again" autoComplete="new-password" />
              </div>
              <button disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded text-sm cursor-pointer disabled:opacity-60">
                {busy ? 'PLEASE WAIT...' : 'SAVE PASSWORD'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- My Account ----------------
export function AccountPage({ user, onShop, onLogout }: { user: any; onShop: () => void; onLogout: () => void }) {
  const meta = (user && user.user_metadata) || {};
  const [tab, setTab] = useState<'orders' | 'profile' | 'password'>('orders');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [name, setName] = useState(meta.name || '');
  const [addr, setAddr] = useState<PkAddress>(addressFromMeta(meta));
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.rpc('my_orders').then(({ data, error }: any) => setOrders(error ? [] : (data || [])));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setMsg('Please enter your name.'); return; }
    const bad = checkPkAddress(addr);
    if (bad) { setMsg(bad); return; }
    const { error } = await supabase.auth.updateUser({
      data: { name: name.trim(), ...addrMeta(addr) }
    });
    setMsg(error ? 'Could not save: ' + error.message : 'Profile saved.');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setMsg('The two passwords are not the same.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? 'Could not save: ' + error.message : 'New password saved.');
    if (!error) { setPw(''); setPw2(''); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const statusColor = (st: string) =>
    st === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : st === 'Cancelled' ? 'bg-red-100 text-red-700' : st === 'Shipped' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800';

  const nav = (key: typeof tab, text: string, Icon: any) => (
    <button
      onClick={() => { setTab(key); setMsg(''); }}
      className={`flex items-center gap-2 px-3 py-2 rounded text-sm text-left whitespace-nowrap cursor-pointer ${tab === key ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="w-4 h-4" /> {text}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6">
      <button onClick={onShop} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline cursor-pointer">
        ← Back to Shop
      </button>
      <div className="grid md:grid-cols-[14rem_1fr] gap-4">
        <aside className="bg-white shadow-sm rounded p-3 h-fit">
          <p className="text-xs text-slate-500 px-3">Hello,</p>
          <p className="font-semibold text-slate-900 px-3 mb-3 truncate">{meta.name || user.email}</p>
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {nav('orders', 'My Orders', Package)}
            {nav('profile', 'My Profile', User)}
            {nav('password', 'Change Password', Lock)}
            <button onClick={onShop} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap cursor-pointer">
              <Package className="w-4 h-4" /> Continue Shopping
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50 whitespace-nowrap cursor-pointer">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </nav>
        </aside>

        <section className="bg-white shadow-sm rounded p-4 sm:p-6 min-w-0">
          {msg && <p className="mb-4 text-sm bg-slate-50 border rounded px-3 py-2">{msg}</p>}

          {tab === 'orders' && (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">My Orders</h2>
              {orders === null && <p className="text-sm text-slate-500">Loading...</p>}
              {orders && orders.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-500 mb-3">You have no orders yet.</p>
                  <button onClick={onShop} className="bg-amber-600 text-white text-sm px-5 py-2.5 rounded cursor-pointer">Continue Shopping</button>
                </div>
              )}
              <div className="space-y-3">
                {(orders || []).map(o => (
                  <div key={o.id} className="border rounded">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b text-xs">
                      <span>Order <b>{o.invoice_no}</b> · {fmt(o.created_at)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${statusColor(o.status)}`}>{o.status || 'Pending'}</span>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-sm">
                      {(o.items || []).map((it: any, i: number) => (
                        <div key={i} className="flex justify-between gap-3">
                          <span className="text-slate-700">{it.quantity} x {it.product_name}</span>
                          <span className="text-slate-500 whitespace-nowrap">{money(it.unit_price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <details className="px-3 py-2 border-t text-xs">
                      <summary className="cursor-pointer font-semibold text-amber-700">
                        Track this order{o.tracking_no ? ` · ${o.courier || ''} ${o.tracking_no}` : ''}
                      </summary>
                      <div className="pt-3"><TrackTimeline o={o} /></div>
                    </details>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t text-xs">
                      <span className="text-slate-500">
                        {o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_method} · {o.payment_status === 'Paid' ? 'Paid' : 'Payment pending'}
                      </span>
                      <span className="flex items-center gap-3">
                        <b className="text-amber-600 text-sm">{money(o.total_amount)}</b>
                        <a href={`/?invoice=${o.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-600 hover:underline">
                          <FileText className="w-3.5 h-3.5" /> Invoice
                        </a>
                        {o.status !== 'Cancelled' && (
                          <a href={`/returns?order=${encodeURIComponent(o.invoice_no)}`} className="text-rose-600 hover:underline">Return</a>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'profile' && (
            <form onSubmit={saveProfile} className="max-w-2xl space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">My Profile</h2>
              <div><label className={lbl}>Full Name</label><input value={name} onChange={(e) => setName(e.target.value)} className={box} /></div>
              <div><label className={lbl}>Email</label><input value={user.email || ''} disabled className={box + ' bg-slate-50 text-slate-500'} /></div>
              <PkAddressFields value={addr} onChange={setAddr} />
              <button className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-6 py-3 rounded cursor-pointer">SAVE</button>
              <p className="text-[11px] text-slate-500">Your name, mobile and address are filled in automatically at checkout.</p>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={savePassword} className="max-w-lg space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
              <div><label className={lbl}>New Password</label><PasswordInput value={pw} onChange={setPw} placeholder="At least 6 characters" autoComplete="new-password" /></div>
              <div><label className={lbl}>Confirm New Password</label><PasswordInput value={pw2} onChange={setPw2} placeholder="Type it again" autoComplete="new-password" /></div>
              <button className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-6 py-3 rounded cursor-pointer">SAVE PASSWORD</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
