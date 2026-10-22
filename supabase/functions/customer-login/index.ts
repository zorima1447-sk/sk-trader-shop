// Supabase Edge Function: customer-login
//
// Lets a customer log in with his PHONE NUMBER + password (email + password works directly in the website).
// The phone number is turned into the account's email inside the database (email_for_phone), then the
// normal Supabase login is done here. The email is never sent back unless the password is right.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-region, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

const WRONG = 'Wrong phone number / email or password.';

Deno.serve(async (req) => {
  // Answer the browser's permission check; allow whatever headers the website asks for
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...cors, 'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers'] },
    });
  }
  try {
    const { login, password } = await req.json().catch(() => ({}));
    if (!login || !password) return json({ error: WRONG });

    let email = String(login).trim();
    if (!email.includes('@')) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data } = await admin.rpc('email_for_phone', { p_phone: email });
      if (!data) return json({ error: WRONG });
      email = String(data);
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.signInWithPassword({ email, password: String(password) });
    if (error || !data.session) {
      const msg = error && /confirm/i.test(error.message) ? 'Please confirm your email first (check your inbox).' : WRONG;
      return json({ error: msg });
    }
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e) {
    return json({ error: String(e) });
  }
});
