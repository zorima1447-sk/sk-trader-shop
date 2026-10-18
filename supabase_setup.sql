-- =====================================================================
-- SK Trader Shop - Supabase setup (SAFE to run more than once)
-- Supabase Dashboard > SQL Editor > New query > paste all > Run
-- Purani tables/data delete nahi hoga; sirf missing tables/columns banenge.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- 1. CATEGORIES ----------
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now() not null
);

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
  add column if not exists stock_quantity int default 50;

-- Agar purani table mein category_id NOT NULL tha to wo insert rok deta hai
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='products' and column_name='category_id') then
    alter table public.products alter column category_id drop not null;
  end if;
end $$;

-- ---------- 3. ORDERS ----------
create sequence if not exists public.invoice_seq start 1001;

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);
alter table public.orders
  add column if not exists invoice_no text unique default ('ZP-' || nextval('public.invoice_seq')),
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists shipping_address text,
  add column if not exists total_amount numeric default 0,
  add column if not exists payment_method text default 'cod',
  add column if not exists payment_status text default 'Pending',
  add column if not exists transaction_id text,
  add column if not exists status text default 'Pending';

-- ---------- 4. ORDER ITEMS (har order ki products) ----------
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  quantity int not null default 1,
  unit_price numeric not null default 0,
  created_at timestamptz default now() not null
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- ---------- 5. PROFILES (admin users: add / edit / delete) ----------
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password text not null,
  role text not null default 'Staff Admin',
  created_at timestamptz default now() not null
);

-- ---------- 6. PAYMENT ACCOUNTS ----------
create table if not exists public.payment_accounts (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  account_number text not null,
  account_title text not null,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

-- ---------- 7. RLS (open access, jaisa aap ne kaha) ----------
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.profiles         enable row level security;
alter table public.payment_accounts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','orders','order_items','profiles','payment_accounts']
  loop
    execute format('drop policy if exists "Allow All" on public.%I', t);
    execute format('create policy "Allow All" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- 8. STARTING DATA ----------
insert into public.categories (name) values ('Hair Care'), ('Bleach & Color'), ('Skin Care')
on conflict (name) do nothing;

-- Pehla admin login: username = zorima / password = 123
-- (login ke baad Admin Users tab se password badal dein)
insert into public.profiles (username, password, role) values
  ('zorima', '123', 'Super Admin'),
  ('admin',  '123', 'Admin')
on conflict (username) do nothing;

insert into public.payment_accounts (type, account_number, account_title)
select * from (values
  ('EasyPaisa',   '0300-1234567',             'Zorima Official Account'),
  ('JazzCash',    '0300-7654321',             'Zorima Business Account'),
  ('UBL Bank',    'PK12-UBL-0000-1234-5678',  'Zorima UBL Account'),
  ('Meezan Bank', 'PK12-MEZN-0000-1234-5678', 'Zorima Meezan Account')
) as v(type, account_number, account_title)
where not exists (select 1 from public.payment_accounts);

-- API ko naye columns/tables ka pata chal jaye
notify pgrst, 'reload schema';
