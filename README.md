# SK Trader Online Store

React + Vite + TypeScript + Tailwind + Supabase.

## 1. Supabase setup (sirf ek baar, dobara run karna safe hai)
1. Supabase Dashboard > **SQL Editor** > New query.
2. `supabase_setup.sql` ka poora content paste karke **Run** karein.
3. Pehla admin login (sirf tab banta hai jab koi admin na ho): `zorima` / `123`.
   Login ke baad **Admin Users** tab se password badal dein.

## 2. GitHub par upload
```
git init
git add .
git commit -m "SK Trader shop"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

## 3. Vercel environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Variables add karne ke baad (ya naya code push karne ke baad) **Redeploy** zaroor karein.

## 4. Order alerts
**Admin panel khula ho:** naya order aate hi screen par alert + awaaz + browser notification
(Supabase Realtime, `supabase_setup.sql` mein ON ho jata hai). Kuch set karne ki zaroorat nahi.

**Panel band ho tab Email / WhatsApp alert** (optional, free):
1. Supabase > **Edge Functions** > *Deploy a new function* > naam: `notify-order`
   > `supabase/functions/notify-order/index.ts` ka code paste karke Deploy.
2. Supabase > Edge Functions > **Secrets** mein add karein:
   - `RESEND_API_KEY` : resend.com par free account banakar API key. (Free plan mein email sirf us email par jati hai jis se Resend account banaya.)
   - `CALLMEBOT_APIKEY` : callmebot.com par WhatsApp activation ka tareeqa follow karke mili key (apne hi number par alert aata hai).
3. Admin panel > **Order Alerts** tab: Email/WhatsApp ON karein, email aur number likhein, **Save**, phir **Send Test Alert**.

## 5. Stock
Add Product mein **Stock Quantity** likhein. Har order par stock khud kam hota hai aur **Sold** barhta hai
(Admin > Products list mein "Stock | Sold" dikhta hai). Stock 0 ho to store par "Out of Stock" aata hai.

## Local run
```
cp .env.example .env   # aur apni keys likhein
npm install
npm run dev
```

## Nota
RLS policies abhi sab ke liye open hain aur admin passwords `profiles` table mein plain text hain.
Alert ka email/phone bhi `notification_settings` mein hai jo anon key se parha ja sakta hai.
Live store ke liye Supabase Auth + strict policies lagana behtar hai.
