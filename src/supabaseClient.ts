import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ikvffqlkjptnqnqttjj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing: add it in Vercel > Settings > Environment Variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
