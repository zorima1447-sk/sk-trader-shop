import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ikvffqlkjtptnqnvttjj.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing: add it in Vercel > Settings > Environment Variables.');
}

// Admin login token. After a successful login every database request carries it in the
// "x-admin-token" header; the database (is_admin()) and the Edge Functions check it.
// It is kept only in memory, so refreshing the page logs the admin out (as before).
let adminToken: string | null = null;

export function setAdminToken(token: string | null) {
  adminToken = token;
}

export function getAdminToken() {
  return adminToken;
}

const fetchWithAdminToken: typeof fetch = (input, init = {}) => {
  if (!adminToken) return fetch(input, init);
  const headers = new Headers(init.headers || {});
  headers.set('x-admin-token', adminToken);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithAdminToken },
});
