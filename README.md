# SK Trader Online Store

React + Vite + TypeScript + Tailwind + Supabase.

## 1. Supabase setup (once; running it again is safe)
1. Supabase Dashboard > **SQL Editor** > New query.
2. Paste the whole content of `supabase_setup.sql` and click **Run**.
3. First admin login (only created on a brand-new database with no admin): `zorima` / `zorima123`.
   Change the password from the **Admin Users** tab after logging in (the site reminds you if the password is weak).
   Existing admin users keep their passwords; running the file turns them into secure hashes.

## 2. Upload to GitHub
The repository root must contain `package.json` and `index.html`. Only the files below belong in the repository
(do not keep old copies of `App.tsx`, `main.tsx` etc. in the root folder):

```
.gitignore  .env.example  README.md  package.json  index.html  vite.config.ts  tailwind.config.js  postcss.config.js  supabase_setup.sql
supabase/functions/notify-order/index.ts
supabase/functions/notify-customers/index.ts
src/App.tsx  src/GeoFields.tsx  src/Invoice.tsx  src/SettingsPanel.tsx  src/storeSettings.ts  src/main.tsx  src/index.css  src/supabaseClient.ts
src/components/ProductForm.jsx
```

## 3. Vercel environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Redeploy after adding variables or pushing new code. The store footer and the admin login page show the build tag (for example `v6`).
If you cannot see it, an old version is still deployed.

## 4. Emails, invoices and alerts (Edge Functions)
Deploy two functions: Supabase > **Edge Functions** > *Deploy a new function*, paste the code from the matching file.

| Function | File | What it does |
|---|---|---|
| `notify-order` | `supabase/functions/notify-order/index.ts` | On every order: alert to the owner (email + WhatsApp) with customer details and amount; invoice email to the customer (optional SMS / WhatsApp via Twilio). |
| `notify-customers` | `supabase/functions/notify-customers/index.ts` | Emails customers about a new product or a deal. Admin only. |

Secrets (Supabase > Edge Functions > **Secrets**):
- `RESEND_API_KEY` (required for any email) - free key from resend.com.
  The Resend test sender can only email your own Resend account address. To email real customers, verify your domain in Resend and set the sender
  (for example `My Store <orders@mydomain.com>`) in **Admin > Settings > Customer Messages**.
- `CALLMEBOT_APIKEY` (optional) - owner WhatsApp alerts to your own number, from callmebot.com.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` (optional, paid) - automatic SMS / WhatsApp of the invoice link to the customer.

Then open **Admin > Order Alerts**, enter your email / WhatsApp number, turn them on, **Save** and press **Send Test Alert**.

Without Twilio, the confirmation screen and the Orders tab still have manual **Share on WhatsApp** buttons for the invoice link.

## 5. Settings page (Admin > Settings)
- **Store Profile:** logo, name, contact phone / email / address, WhatsApp, social links.
- **Website Look:** accent colour, announcement bar, home page sections, footer text.
- **Invoice:** logo, tax number, notes, and which payment accounts appear on the invoice (with a live preview).
- **Customer Messages:** invoice email on/off, sender address, SMS / WhatsApp mode, default for new-product emails.

Invoices open at `https://your-site/?invoice=<order id>` and can be printed or saved as PDF.

## 6. Admin panel overview
Products, Categories, Orders (edit order, invoice, mark delivered, payment received), Customers (add / edit / delete, deal emails),
Payments (ledger by category and account), Reviews, Home Slides, Admin Users, Bank Accounts, Order Alerts, Settings.

## Local run
```
cp .env.example .env   # then fill in your keys
npm install
npm run dev
```

## Security (v7)
- Admin passwords are stored only as bcrypt hashes and are checked inside the database (`admin_login`).
  5 wrong passwords in a row lock that user for 15 minutes.
- After login the website gets a random token (valid 12 hours) and sends it in the `x-admin-token` header.
  The database (`is_admin()`) and the Edge Functions accept admin actions only with a valid token.
- Visitors can only read the shop: products, categories, slides, store settings, active payment accounts and
  reviews (name, stars and remark only). Orders, customers, payments, alert settings and admin users are private.
- Orders are saved by `place_order()`: prices and totals come from the products table, not from the browser.
- The invoice page uses `get_invoice(<order id>)`, which returns only that one order.
- New-order alerts in the admin panel check every 20 seconds (Realtime is no longer used for orders).
- Logo uploads: the website can add new `logo-*.png` files to the `site-assets` bucket but cannot replace or delete files.
