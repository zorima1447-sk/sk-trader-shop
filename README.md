# SK Trader Online Store

React + Vite + TypeScript + Tailwind + Supabase.

## 1. Supabase setup (sirf ek baar)
1. Supabase Dashboard > **SQL Editor** > New query.
2. `supabase_setup.sql` ka poora content paste karke **Run** karein.
   (Dobara run karna safe hai, data delete nahi hota.)
3. Pehla admin login: `zorima` / `123`. Login ke baad **Admin Users** tab se password badal dein.

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
Vercel > Project > Settings > Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Variables add karne ke baad **Redeploy** zaroor karein.

## Local run
```
cp .env.example .env   # aur apni keys likhein
npm install
npm run dev
```

## Nota
RLS policies abhi sab ke liye open hain (sab tables par full access) aur admin passwords `profiles`
table mein plain text hain. Live store ke liye Supabase Auth + strict policies lagana behtar hai.
