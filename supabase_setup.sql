-- =====================================================================
-- SK Trader Shop - Supabase setup (SAFE to run more than once)
-- Supabase Dashboard > SQL Editor > New query > paste everything > Run
-- Existing tables and data are NOT deleted; only missing tables/columns are created.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- 1. CATEGORIES ----------
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now() not null
);
alter table public.categories
  add column if not exists name text,
  add column if not exists created_at timestamptz default now();

-- ---------- 2. PRODUCTS ----------
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now() not null
);
alter table public.products
  add column if not exists description text,
  add column if not exists original_price numeric default 0,
  add column if not exists discounted_price numeric default 0,
  add column if not exists price numeric default 0,
  add column if not exists image_url text,
  add column if not exists category_name text default 'Hair Care',
  add column if not exists stock_quantity int default 50,
  add column if not exists sold_quantity int default 0;

update public.products set sold_quantity = 0 where sold_quantity is null;

-- An old category_id column that is NOT NULL would block inserts
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='category_id') then
    alter table public.products alter column category_id drop not null;
  end if;
end $$;

-- ---------- 3. CUSTOMERS ----------
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  name text,
  created_at timestamptz default now() not null
);
alter table public.customers
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone_iso text,
  add column if not exists phone_code text,
  add column if not exists phone text,
  add column if not exists country_iso text,
  add column if not exists country text,
  add column if not exists province_iso text,
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists marketing_opt_in boolean default true;

-- ---------- 4. ORDERS ----------
create sequence if not exists public.invoice_seq start 1001;

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);
alter table public.orders
  add column if not exists invoice_no text unique default ('ZP-' || nextval('public.invoice_seq')),
  add column if not exists customer_id uuid,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists shipping_address text,
  add column if not exists total_amount numeric default 0,
  add column if not exists payment_method text default 'cod',
  add column if not exists payment_status text default 'Unpaid',
  add column if not exists transaction_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists paid_amount numeric default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists notified boolean default false,
  add column if not exists invoice_sent boolean default false,
  add column if not exists status text default 'Pending';

alter table public.orders
  alter column invoice_no set default ('ZP-' || nextval('public.invoice_seq'));

update public.orders set paid_amount = 0 where paid_amount is null;

-- ---------- 5. ORDER ITEMS ----------
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid,
  created_at timestamptz default now() not null
);
alter table public.order_items
  add column if not exists order_id uuid,
  add column if not exists product_id uuid,
  add column if not exists product_name text,
  add column if not exists quantity int default 1,
  add column if not exists unit_price numeric default 0;

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- ---------- 6. PAYMENTS (every payment received) ----------
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid,
  amount numeric not null default 0,
  created_at timestamptz default now() not null
);
alter table public.payments
  add column if not exists order_id uuid,
  add column if not exists amount numeric default 0,
  add column if not exists method text,
  add column if not exists category text,
  add column if not exists account_id text,
  add column if not exists account_label text,
  add column if not exists reference text,
  add column if not exists note text,
  add column if not exists received_at timestamptz default now();

create index if not exists payments_order_id_idx on public.payments(order_id);

-- ---------- 7. REVIEWS ----------
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);
alter table public.reviews
  add column if not exists product_id uuid,
  add column if not exists order_id uuid,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists rating int default 5,
  add column if not exists remark text;
create index if not exists reviews_product_id_idx on public.reviews(product_id);

-- ---------- 8. PROFILES (admin users) ----------
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);
alter table public.profiles
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists role text default 'Staff Admin';

-- ---------- 9. PAYMENT ACCOUNTS (bank / wallet accounts shown at checkout) ----------
create table if not exists public.payment_accounts (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  account_number text not null,
  account_title text not null,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

-- ---------- 10. ORDER ALERT SETTINGS ----------
create table if not exists public.notification_settings (
  id int primary key default 1,
  email_enabled boolean default false,
  email_to text,
  whatsapp_enabled boolean default false,
  whatsapp_phone text,
  updated_at timestamptz default now()
);
insert into public.notification_settings (id)
select 1 where not exists (select 1 from public.notification_settings where id = 1);

-- ---------- 11. HOME PAGE SLIDES ----------
create table if not exists public.hero_slides (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);
alter table public.hero_slides
  add column if not exists title text,
  add column if not exists text text,
  add column if not exists cta text default 'Shop Now',
  add column if not exists bg text default 'gold',
  add column if not exists image_url text,
  add column if not exists sort_order int default 0,
  add column if not exists active boolean default true;

-- ---------- 11b. STORE SETTINGS (logo, name, contact, look, invoice options) ----------
create table if not exists public.store_settings (
  id int primary key default 1,
  updated_at timestamptz default now()
);
alter table public.store_settings
  add column if not exists store_name text,
  add column if not exists header_subtitle text,
  add column if not exists tagline text,
  add column if not exists logo_url text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists whatsapp text,
  add column if not exists facebook text,
  add column if not exists instagram text,
  add column if not exists tiktok text,
  add column if not exists announcement text,
  add column if not exists show_announcement boolean,
  add column if not exists accent text,
  add column if not exists footer_text text,
  add column if not exists show_trust boolean,
  add column if not exists show_categories boolean,
  add column if not exists show_whatsapp_strip boolean,
  add column if not exists invoice_header_note text,
  add column if not exists invoice_footer_note text,
  add column if not exists invoice_tax_id text,
  add column if not exists invoice_account_ids jsonb default '[]'::jsonb,
  add column if not exists invoice_show_logo boolean,
  add column if not exists invoice_show_accounts boolean,
  add column if not exists email_invoice_enabled boolean,
  add column if not exists email_from text,
  add column if not exists customer_msg_mode text,
  add column if not exists notify_new_product boolean;

insert into public.store_settings (id)
select 1 where not exists (select 1 from public.store_settings where id = 1);

-- ---------- 11c. STORAGE bucket for the logo (public, so it also shows inside emails) ----------
do $$
begin
  insert into storage.buckets (id, name, public) values ('site-assets', 'site-assets', true)
  on conflict (id) do update set public = true;

  drop policy if exists "site-assets read"   on storage.objects;
  drop policy if exists "site-assets insert" on storage.objects;
  drop policy if exists "site-assets update" on storage.objects;
  drop policy if exists "site-assets delete" on storage.objects;
  create policy "site-assets read"   on storage.objects for select using (bucket_id = 'site-assets');
  create policy "site-assets insert" on storage.objects for insert with check (bucket_id = 'site-assets');
  create policy "site-assets update" on storage.objects for update using (bucket_id = 'site-assets');
  create policy "site-assets delete" on storage.objects for delete using (bucket_id = 'site-assets');
exception when others then
  raise notice 'Storage bucket setup skipped: %', sqlerrm;
end $$;

-- ---------- 12. STOCK: decrease stock and increase sold on every order ----------
create or replace function public.decrement_stock(p_id uuid, p_qty int)
returns void
language sql
as $$
  update public.products
  set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_qty, 0),
      sold_quantity  = coalesce(sold_quantity, 0) + p_qty
  where id = p_id;
$$;

-- ---------- 13. Remove old NOT NULL constraints ----------
-- Old tables may contain extra columns (for example profiles.email) that are NOT NULL
-- and block inserts. Every column except "id" is made nullable.
do $$
declare r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('categories','products','customers','orders','order_items','payments','reviews',
                         'profiles','payment_accounts','notification_settings','hero_slides','store_settings')
      and is_nullable = 'NO'
      and column_name <> 'id'
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
  end loop;
end $$;

-- ---------- 14. RLS (open access) ----------
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.customers             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.payments              enable row level security;
alter table public.reviews               enable row level security;
alter table public.profiles              enable row level security;
alter table public.payment_accounts      enable row level security;
alter table public.notification_settings enable row level security;
alter table public.hero_slides           enable row level security;
alter table public.store_settings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','orders','order_items','payments','reviews',
                           'profiles','payment_accounts','notification_settings','hero_slides','store_settings']
  loop
    execute format('drop policy if exists "Allow All" on public.%I', t);
    execute format('create policy "Allow All" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- 15. STARTING DATA ----------
insert into public.categories (name)
select v.name from (values ('Hair Care'), ('Bleach & Color'), ('Skin Care')) as v(name)
where not exists (select 1 from public.categories c where c.name = v.name);

-- First admin login (created ONLY when no admin exists yet): zorima / 123
-- Change the password from the Admin Users tab after logging in.
-- Running this file again will NOT bring old names/passwords back.
insert into public.profiles (username, password, role)
select v.username, v.password, v.role from (values
  ('zorima', '123', 'Super Admin'),
  ('admin',  '123', 'Admin')
) as v(username, password, role)
where not exists (select 1 from public.profiles p where p.username is not null and p.password is not null);

insert into public.payment_accounts (type, account_number, account_title)
select * from (values
  ('EasyPaisa',   '0300-1234567',             'Zorima Official Account'),
  ('JazzCash',    '0300-7654321',             'Zorima Business Account'),
  ('UBL Bank',    'PK12-UBL-0000-1234-5678',  'Zorima UBL Account'),
  ('Meezan Bank', 'PK12-MEZN-0000-1234-5678', 'Zorima Meezan Account')
) as v(type, account_number, account_title)
where not exists (select 1 from public.payment_accounts);

-- ---------- 16. REALTIME (live alert for new orders) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- Let the API see the new tables / columns
notify pgrst, 'reload schema';
