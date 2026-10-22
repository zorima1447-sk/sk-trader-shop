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
supabase/functions/customer-login/index.ts
src/App.tsx  src/CustomerAuth.tsx  src/icons.tsx  src/GeoFields.tsx  src/Invoice.tsx  src/SettingsPanel.tsx  src/storeSettings.ts  src/main.tsx  src/index.css  src/supabaseClient.ts
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

## v14: pictures for shades and sizes
- Each option (shade / size) can have its own picture (Admin > Products > Options, picture box at the start of the row).
- "+ Add from pictures": select many pictures at once; the file name becomes the shade name ("4.0 Medium Brown.jpg").
  A shade that already exists with that name just gets the picture. Good for 60+ shades.
- Product page: picking a shade/size shows its picture as the main picture; with pictures the shades show as a
  picture grid (with a search box when there are more than 12), plus the dropdown. The cart shows the shade's picture.
- Pictures go to Supabase Storage (bucket site-assets, files variant-*.jpg). Run `supabase_setup.sql` again first.

## v13: hair colour shades (product options)
- Admin > Products > Options: choose what the options are called (Size, Shade, Color, Pack, Weight or your own word),
  "+ Add many" pastes many shade names at once (one per line), each option can have a colour dot, price, old price, stock.
- Product page: "Shade: 4.0 Medium Brown" with the colour dot; more than 8 options show as a dropdown, fewer as buttons.
  Product cards say "Choose Shade"; cart and invoice show the chosen shade.
- Run `supabase_setup.sql` again (new column products.variant_label).

## v12: order tracking
- Admin > Orders > "Add courier / tracking": courier (own rider, TCS, Leopards, M&P, Trax, PostEx, BlueEx, Call Courier,
  bus cargo, Pakistan Post, Other), tracking / CN number, optional tracking link; can mark the order Shipped.
  Then "Send tracking on WhatsApp" sends the customer a ready message.
- Customers: "Track Order" (top bar, footer, after ordering, `/?track=<order no>`): order number + last 4 digits of
  the mobile -> Placed / Confirmed / Shipped / Delivered with dates, courier, tracking no and "Track with courier".
  Also in My Account > My Orders, and the AI bot answers with it.
- Run `supabase_setup.sql` again (new columns + track_order function) and re-deploy `ai-chat`.

## v11: AI assistant, GST, order numbers, delete, share
- **Order numbers with the date**: SK-261022-1005 (prefix in Admin > Invoice). Old orders keep their numbers.
- **Delete order**: Admin > Orders > "Delete order" (asks whether to put the items back in stock).
- **Invoice PDF name**: Print / Save as PDF suggests "<order no> - <customer name>".
- **GST (FBR)**: Admin > Invoice: NTN, STRN, GST rate, prices including / excluding GST. The database calculates the tax;
  the invoice becomes a "Sales Tax Invoice" with value excl. tax, sales tax and total. (Real-time FBR POS reporting
  needs FBR's POS integration and is not included.)
- **Cash on Delivery only in Karachi** (Admin > Delivery Charges, on by default); other cities must pay online.
  Checked in the database too.
- **Share** button opens WhatsApp, Facebook, Messenger, X, Telegram, Pinterest, LinkedIn, Email or Copy link.
- Cart: items and amounts always visible; logged-in customers get name, email, mobile and address filled in,
  and the address of each order is saved back to their account.
- **AI assistant** (Edge Function `ai-chat`, uses Claude by Anthropic):
  - Customers: chat button on the shop (turn on in Admin > Customer Messages). Finds products, prices, sizes,
    delivery charges and payment options, and tracks an order (order number + last 4 digits of the mobile).
  - Admin: Admin > AI Assistant. Sales summary, orders, unpaid online payments, low stock, customers; on request it
    changes an order status, marks an order paid, or changes stock / price. It cannot delete or change settings.
  - **Free**: deploy `ai-chat` ("Verify JWT" ON). With no key, a free built-in bot answers by keywords
    (products, prices, sizes, delivery, COD, order tracking; admin: sales, pending orders, low stock, payments to check).
  - **Free real AI**: get a free key at https://aistudio.google.com/apikey and add the secret `GEMINI_API_KEY`
    (optional `GEMINI_MODEL`, default `gemini-2.5-flash`). Or a free Groq key: `GROQ_API_KEY`.
    Free tiers have daily limits; when the limit is reached the customer chat falls back to the built-in bot.
    Google may use free-tier chats to improve its products - do not put private data in the bot.
  - Paid alternative: `ANTHROPIC_API_KEY` (Claude). `AI_PROVIDER` = gemini | groq | claude | builtin chooses one.

## v10: Pakistan addresses and delivery charges
- Register, checkout and My Profile use a Pakistan-only address: +92 mobile (required), Province -> City -> Area
  dropdowns (src/pakistan.ts; "Other area" lets the customer type it), street address and 5-digit postal code
  (filled in from the city, can be changed). Email is required.
- Admin > Delivery Charges: Karachi city charge (0 = free), a charge for each province (Sindh = the rest of Sindh),
  a default charge, and "free delivery from Rs. X". The database calculates the charge in place_order, so the
  total cannot be changed from the browser. Cart, invoice, emails and owner alert show subtotal + delivery.
- Admin > Orders and Customers: city buttons (with counts) to filter, and sort by date / city / amount / name.
- Run `supabase_setup.sql` again after updating (new columns).

## v9: customer accounts, online payment, sizes, admin menu
- **Customer accounts** (Supabase Auth): Login with phone number or email + password, Register, Forgot password,
  Google / Facebook buttons, "My Account" (My Orders with invoice links, profile, change password).
  A visitor who presses Add to Cart / Buy Now is asked to log in or register first; the item is added right after.
- **Online payment**: the customer chooses one of your Payment Accounts, sees the amount and account number (Copy button),
  then enters sender name, sender number, Transaction ID, amount, date/time and a screenshot. Admin > Orders shows
  all of it ("View screenshot") and the owner alert includes it. Cash on Delivery stays available.
- **Sizes** (250 ML / 500 ML ...): Admin > Products > "+ Add size" (name, price, old price, stock for each size).
  The customer picks the size on the product page; price and stock come from that size (checked in the database).
- **Search** finds short / partial words, several words in any order and small spelling mistakes, with live suggestions.
- **Admin** has a side menu (Dashboard, Orders, Payments, Customers, Reviews, Products, Categories, Home Banner,
  Theme & Look, Store Profile, Payment Accounts, Invoice, Customer Messages, Order Alerts, Admin Users) and a Dashboard.
- **Themes**: Settings > Theme & Look - 8 ready themes, header style, page background, 10 accent colours.
- Header: the admin button is a lock icon.

### One-time setup for v9
1. Supabase > SQL Editor: run the whole `supabase_setup.sql` again (safe; keeps all data).
2. Supabase > Edge Functions: deploy `customer-login` (new) and re-deploy `notify-order`.
3. Supabase > Authentication > URL Configuration: Site URL = `https://sk-trader-shop.vercel.app`,
   and add the same address under Redirect URLs.
4. Supabase > Authentication > Sign In / Providers > Email: keep "Confirm email" ON (customers confirm by email)
   or turn it OFF (customers can buy right after registering).
5. Optional: Google / Facebook login - turn the provider on in Supabase > Authentication > Providers
   (needs a Google Cloud / Facebook developer app). Until then those buttons show a friendly message.
6. Optional: Supabase's built-in email sender is limited to a few emails per hour. For many customers,
   add your own SMTP (for example Resend) in Supabase > Authentication > Emails > SMTP Settings.

## v8: shop look and banner
- Marketplace-style home page: coloured header with search, category list + banner, scrolling strip, Flash Sale
  (discounted products), category tiles, "Just For You" product grid with sorting.
- Product page with its own link (`?product=<id>`), Buy Now / Add to Cart, reviews and "You may also like".
  The phone's Back button closes it.
- Admin > Home Slides > **Choose pictures**: select 5-6 pictures at once; each becomes a picture-only slide.
  Pictures go to Supabase Storage (bucket `site-assets`). Leave Title/Text empty for a picture-only slide.
- Admin > Settings > Website Look > **Scrolling strip**: text and icon (or emoji) for each item, order, speed, on/off.
  An "Orange" accent colour is available too.
- A reload shows the last saved look at once (kept in the browser) instead of the built-in default look.

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
