import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ikvffqlkjptnqnqttjj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY missing: Vercel > Settings > Environment Variables mein add karein.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
