# SK Trader Online Store

React + Vite + TypeScript + Tailwind + Supabase.

## 1. Supabase setup (once; running it again is safe)
1. Supabase Dashboard > **SQL Editor** > New query.
2. Paste the whole content of `supabase_setup.sql` and click **Run**.
3. First admin login (only created when no admin exists): `zorima` / `123`.
   Change the password from the **Admin Users** tab after logging in.

## 2. Upload to GitHub
Repository layout (the repo root must contain `package.json` and `index.html`):

```
package.json
index.html
vite.config.ts
tailwind.config.js
postcss.config.js
supabase_setup.sql
supabase/functions/notify-order/index.ts
src/App.tsx
src/GeoFields.tsx
src/main.tsx
src/index.css
src/supabaseClient.ts
```

`App.tsx`, `GeoFields.tsx`, `main.tsx`, `index.css` and `supabaseClient.ts` must be inside the **src** folder.

## 3. Vercel environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Redeploy after adding variables or pushing new code. The footer of the store and the admin login page show the build tag (for example `v5`).
If you cannot see it, an old version is still deployed.

## 4. Order alerts
**Admin panel open:** a new order shows an on-screen alert, a sound and a browser notification (Supabase Realtime, enabled by the SQL file).

**Admin panel closed (optional, free):**
1. Supabase > **Edge Functions** > *Deploy a new function* > name: `notify-order` > paste `supabase/functions/notify-order/index.ts`.
2. Supabase > Edge Functions > **Secrets**:
   - `RESEND_API_KEY`: free API key from resend.com (the free plan only emails the address used to sign up).
   - `CALLMEBOT_APIKEY`: key from callmebot.com after WhatsApp activation (alerts go to your own number).
3. Admin > **Order Alerts**: turn Email / WhatsApp on, enter the email and number, **Save**, then **Send Test Alert**.

## 5. Admin panel overview
Products (with stock and sold), Categories, Orders (edit order, mark delivered, payment received), Customers (add / edit / delete),
Payments (ledger by cash / bank / wallet and by account), Reviews, Home Slides (edit the home page slider), Admin Users, Bank Accounts, Order Alerts.

## Local run
```
cp .env.example .env   # then fill in your keys
npm install
npm run dev
```

## Note
RLS policies are open to everyone and admin passwords are stored as plain text in `profiles`.
The alert email / phone in `notification_settings` can be read with the anon key.
Before a serious launch, use Supabase Auth and stricter policies.
