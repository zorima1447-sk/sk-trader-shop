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
  add column if not exists delivered_at timestamptz,
  add column if not exists notified boolean default false,
  add column if not exists status text default 'Pending';

alter table public.orders
  alter column invoice_no set default ('ZP-' || nextval('public.invoice_seq'));

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
alter table public.order_items
  add column if not exists order_id uuid,
  add column if not exists product_id uuid,
  add column if not exists product_name text,
  add column if not exists quantity int default 1,
  add column if not exists unit_price numeric default 0;

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- ---------- 5. PROFILES (admin users: add / edit / delete) ----------
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password text not null,
  role text not null default 'Staff Admin',
  created_at timestamptz default now() not null
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists role text default 'Staff Admin';

-- ---------- 6. PAYMENT ACCOUNTS ----------
create table if not exists public.payment_accounts (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  account_number text not null,
  account_title text not null,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

-- ---------- 6a. ORDER ALERT SETTINGS (email / whatsapp on-off) ----------
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

-- ---------- 6a2. STOCK KAM + SOLD ZYADA (order ke waqt) ----------
create or replace function public.decrement_stock(p_id uuid, p_qty int)
returns void
language sql
as $$
  update public.products
  set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_qty, 0),
      sold_quantity  = coalesce(sold_quantity, 0) + p_qty
  where id = p_id;
$$;

-- ---------- 6b. PURANE NOT NULL CONSTRAINTS HATAO ----------
-- Purani tables mein extra columns (jaise profiles.email) NOT NULL ho sakte hain
-- aur insert rok dete hain. 'id' ke ilawa sab columns nullable kar diye jate hain.
do $$
declare r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('categories','products','orders','order_items','profiles','payment_accounts','notification_settings')
      and is_nullable = 'NO'
      and column_name <> 'id'
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
  end loop;
end $$;

-- ---------- 7. RLS (open access, jaisa aap ne kaha) ----------
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.profiles         enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.notification_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','orders','order_items','profiles','payment_accounts','notification_settings']
  loop
    execute format('drop policy if exists "Allow All" on public.%I', t);
    execute format('create policy "Allow All" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- 8. STARTING DATA ----------
insert into public.categories (name)
select v.name from (values ('Hair Care'), ('Bleach & Color'), ('Skin Care')) as v(name)
where not exists (select 1 from public.categories c where c.name = v.name);

-- Pehla admin login (SIRF tab banta hai jab koi admin maujood na ho):
-- username = zorima / password = 123. Login ke baad Admin Users tab se badal dein.
-- Dobara run karne par purane naam/password wapas NAHI aayenge.
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

-- ---------- 9. REALTIME (naye order ka live alert) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- API ko naye columns/tables ka pata chal jaye
notify pgrst, 'reload schema';
