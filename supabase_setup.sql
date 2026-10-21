-- =====================================================================
-- SK Trader Shop - Supabase setup (SAFE to run more than once)
-- Supabase Dashboard > SQL Editor > New query > paste everything > Run
-- Existing tables and data are NOT deleted; only missing tables/columns are created.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

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
  add column if not exists password text,          -- old plain-text column, emptied below
  add column if not exists password_hash text,     -- bcrypt hash, the only password that is used
  add column if not exists failed_logins int default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists role text default 'Staff Admin';

-- Admin login sessions (a random token per login, valid for 12 hours)
create table if not exists public.admin_sessions (
  token text primary key,
  profile_id uuid not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz not null
);

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
  -- Only new logo files can be added; existing files cannot be replaced or deleted from the website.
  create policy "site-assets insert" on storage.objects for insert
    with check (bucket_id = 'site-assets' and name like 'logo-%.png');
exception when others then
  raise notice 'Storage bucket setup skipped: %', sqlerrm;
end $$;

-- ---------- 12. STOCK: decrease stock and increase sold on every order ----------
create or replace function public.decrement_stock(p_id uuid, p_qty int)
returns void
language sql
set search_path = public
as $$
  update public.products
  set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_qty, 0),
      sold_quantity  = coalesce(sold_quantity, 0) + p_qty
  where id = p_id;
$$;
-- Only place_order() (below) may change stock; the website cannot call this directly any more.
revoke execute on function public.decrement_stock(uuid, int) from public, anon, authenticated;

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

-- ---------- 13b. Older tables may miss the created_at column ----------
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','orders','order_items','payments','reviews',
                           'profiles','payment_accounts','hero_slides']
  loop
    execute format('alter table public.%I add column if not exists created_at timestamptz default now()', t);
  end loop;
end $$;

-- ---------- 14. ADMIN LOGIN (hashed passwords + session token) ----------
-- Old plain-text passwords are turned into bcrypt hashes and then erased.
update public.profiles
set password_hash = crypt(password, gen_salt('bf'))
where password is not null and password <> '' and password_hash is null;
update public.profiles set password = null where password_hash is not null;

-- Which admin is making this request? The website sends its login token in the "x-admin-token" header.
create or replace function public.current_admin_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.profile_id
  from public.admin_sessions s
  where s.token = (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-admin-token')
    and s.expires_at > now()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select public.current_admin_id() is not null $$;

create or replace function public.admin_login(p_username text, p_password text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.profiles;
  t text;
begin
  select * into u from public.profiles
  where lower(username) = lower(trim(coalesce(p_username, ''))) and password_hash is not null
  limit 1;

  if u.id is null then
    perform pg_sleep(0.5);
    return json_build_object('ok', false, 'error', 'Invalid User ID or Password!');
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    return json_build_object('ok', false, 'error', 'Too many wrong attempts. Please try again after 15 minutes.');
  end if;

  if u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    -- 5 wrong passwords in a row lock the user for 15 minutes
    update public.profiles set
      failed_logins = case when coalesce(failed_logins, 0) + 1 >= 5 then 0 else coalesce(failed_logins, 0) + 1 end,
      locked_until  = case when coalesce(failed_logins, 0) + 1 >= 5 then now() + interval '15 minutes' else locked_until end
    where id = u.id;
    perform pg_sleep(0.5);
    return json_build_object('ok', false, 'error', 'Invalid User ID or Password!');
  end if;

  update public.profiles set failed_logins = 0, locked_until = null where id = u.id;
  delete from public.admin_sessions where expires_at < now();

  t := encode(gen_random_bytes(32), 'hex');
  insert into public.admin_sessions (token, profile_id, expires_at) values (t, u.id, now() + interval '12 hours');

  return json_build_object(
    'ok', true,
    'token', t,
    'username', u.username,
    'role', u.role,
    'weak_password', length(coalesce(p_password, '')) < 6
      or lower(p_password) in ('123456', '1234567', '12345678', 'password', 'admin123', 'zorima123')
  );
end $$;

create or replace function public.admin_logout()
returns void
language sql security definer
set search_path = public
as $$
  delete from public.admin_sessions
  where token = (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-admin-token')
$$;

-- Admin users (list / save / delete) - only for a logged-in admin, passwords are never sent back.
create or replace function public.admin_list_users()
returns table (id uuid, username text, role text, created_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return query
    select p.id, p.username, p.role, p.created_at
    from public.profiles p
    where p.username is not null
    order by p.created_at;
end $$;

create or replace function public.admin_save_user(p_id uuid, p_username text, p_password text, p_role text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uname text := trim(coalesce(p_username, ''));
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  if uname = '' then raise exception 'Please enter a User ID.'; end if;
  if coalesce(p_password, '') <> '' and length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(uname) and id is distinct from p_id) then
    raise exception 'This User ID already exists. Please choose another one.';
  end if;

  if p_id is null then
    if coalesce(p_password, '') = '' then raise exception 'Please enter a password.'; end if;
    insert into public.profiles (username, password_hash, role)
    values (uname, crypt(p_password, gen_salt('bf')), coalesce(nullif(p_role, ''), 'Staff Admin'));
  else
    update public.profiles set
      username = uname,
      role = coalesce(nullif(p_role, ''), role),
      password_hash = case when coalesce(p_password, '') <> '' then crypt(p_password, gen_salt('bf')) else password_hash end,
      password = null,
      failed_logins = 0,
      locked_until = null
    where id = p_id;
    -- a changed password logs that user out everywhere else
    if coalesce(p_password, '') <> '' then
      delete from public.admin_sessions where profile_id = p_id and profile_id <> public.current_admin_id();
    end if;
  end if;
end $$;

create or replace function public.admin_delete_user(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  if p_id = public.current_admin_id() then raise exception 'You cannot delete the user you are logged in with.'; end if;
  if (select count(*) from public.profiles where password_hash is not null) <= 1 then
    raise exception 'At least one admin user must remain.';
  end if;
  delete from public.admin_sessions where profile_id = p_id;
  delete from public.profiles where id = p_id;
end $$;

-- ---------- 15. CHECKOUT, INVOICE AND REVIEWS (safe functions for customers) ----------
-- Prices and totals are taken from the products table, not from the browser.
create or replace function public.place_order(p_customer jsonb, p_order jsonb, p_items jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  cust_id uuid;
  o public.orders;
  it jsonb;
  pr public.products;
  qty int;
  total numeric := 0;
  lines jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if coalesce(trim(p_order ->> 'customer_name'), '') = '' or coalesce(trim(p_order ->> 'customer_phone'), '') = '' then
    raise exception 'Please fill in your name and mobile number.';
  end if;

  -- check every item and work out the total
  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it ->> 'quantity')::int;
    if qty is null or qty < 1 or qty > 1000 then raise exception 'Invalid quantity.'; end if;
    select * into pr from public.products where id = (it ->> 'product_id')::uuid;
    if pr.id is null then raise exception 'A product in your cart is no longer available.'; end if;
    lines := lines || jsonb_build_object(
      'product_id', pr.id,
      'product_name', pr.name,
      'quantity', qty,
      'unit_price', coalesce(nullif(pr.discounted_price, 0), pr.price, 0)
    );
    total := total + coalesce(nullif(pr.discounted_price, 0), pr.price, 0) * qty;
  end loop;

  -- save / update the customer (matched by phone number)
  begin
    if coalesce(p_customer ->> 'phone', '') <> '' then
      select id into cust_id from public.customers
      where phone_code = p_customer ->> 'phone_code' and phone = p_customer ->> 'phone'
      limit 1;
      if cust_id is null then
        insert into public.customers (name, email, phone_iso, phone_code, phone, country_iso, country,
                                      province_iso, province, city, address, marketing_opt_in)
        values (p_customer ->> 'name', nullif(p_customer ->> 'email', ''), p_customer ->> 'phone_iso',
                p_customer ->> 'phone_code', p_customer ->> 'phone', p_customer ->> 'country_iso', p_customer ->> 'country',
                p_customer ->> 'province_iso', p_customer ->> 'province', p_customer ->> 'city', p_customer ->> 'address',
                coalesce((p_customer ->> 'marketing_opt_in')::boolean, true))
        returning id into cust_id;
      else
        update public.customers set
          name = p_customer ->> 'name',
          email = coalesce(nullif(p_customer ->> 'email', ''), email),
          phone_iso = p_customer ->> 'phone_iso',
          country_iso = p_customer ->> 'country_iso', country = p_customer ->> 'country',
          province_iso = p_customer ->> 'province_iso', province = p_customer ->> 'province',
          city = p_customer ->> 'city', address = p_customer ->> 'address',
          marketing_opt_in = coalesce((p_customer ->> 'marketing_opt_in')::boolean, marketing_opt_in)
        where id = cust_id;
      end if;
    end if;
  exception when others then
    cust_id := null;  -- a customer-record problem must not block the order
  end;

  insert into public.orders (customer_id, customer_name, customer_phone, customer_email, shipping_address,
                             total_amount, payment_method, payment_status, paid_amount, transaction_id, status)
  values (cust_id, trim(p_order ->> 'customer_name'), p_order ->> 'customer_phone',
          nullif(trim(coalesce(p_order ->> 'customer_email', '')), ''), p_order ->> 'shipping_address',
          total, coalesce(nullif(p_order ->> 'payment_method', ''), 'cod'), 'Unpaid', 0,
          case when coalesce(p_order ->> 'payment_method', 'cod') = 'cod' then null
               else nullif(p_order ->> 'transaction_id', '') end,
          'Pending')
  returning * into o;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
  select o.id, (l ->> 'product_id')::uuid, l ->> 'product_name', (l ->> 'quantity')::int, (l ->> 'unit_price')::numeric
  from jsonb_array_elements(lines) l;

  for it in select * from jsonb_array_elements(lines) loop
    perform public.decrement_stock((it ->> 'product_id')::uuid, (it ->> 'quantity')::int);
  end loop;

  return json_build_object('order', to_jsonb(o), 'items', lines);
end $$;

-- The printable invoice page (?invoice=<order id>). The order id is a long random code.
create or replace function public.get_invoice(p_order_id uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select case when o.id is null then null else json_build_object(
    'order', to_jsonb(o),
    'items', coalesce((select json_agg(json_build_object('product_name', i.product_name, 'quantity', i.quantity, 'unit_price', i.unit_price) order by i.created_at)
                       from public.order_items i where i.order_id = o.id), '[]'::json)
  ) end
  from (select 1) x left join public.orders o on o.id = p_order_id
$$;

create or replace function public.submit_review(p_product_id uuid, p_order_id uuid, p_name text, p_rating int,
                                                p_remark text, p_email text, p_phone text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare r public.reviews;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'Please enter your name.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 to 5 stars.'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'Product not found.'; end if;
  if p_order_id is not null and exists (select 1 from public.reviews where order_id = p_order_id and product_id = p_product_id) then
    raise exception 'A review for this product has already been submitted for this order.';
  end if;
  insert into public.reviews (product_id, order_id, customer_name, rating, remark, customer_email, customer_phone)
  values (p_product_id, p_order_id, left(trim(p_name), 80), p_rating, left(trim(coalesce(p_remark, '')), 1000),
          nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_phone, '')), ''))
  returning * into r;
  return json_build_object('id', r.id, 'product_id', r.product_id, 'order_id', r.order_id, 'customer_name', r.customer_name,
                           'rating', r.rating, 'remark', r.remark, 'created_at', r.created_at);
end $$;

-- Admin view of reviews (includes the reviewer's email / phone)
create or replace function public.admin_list_reviews()
returns setof public.reviews
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return query select * from public.reviews order by created_at desc;
end $$;

-- ---------- 16. ROW LEVEL SECURITY ----------
-- Customers can only READ the shop (products, categories, slides, settings, active payment accounts, reviews).
-- Everything else (orders, customers, payments, alert settings, admin users) needs an admin login.
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
alter table public.admin_sessions        enable row level security;

-- remove every old policy on these tables (including the old "Allow All")
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('categories','products','customers','orders','order_items','payments','reviews','profiles',
                        'payment_accounts','notification_settings','hero_slides','store_settings','admin_sessions')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- shop data: everyone reads, only admins change
do $$
declare t text;
begin
  foreach t in array array['categories','products','hero_slides','store_settings'] loop
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('create policy "admin write" on public.%I for all using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

create policy "public read active" on public.payment_accounts for select
  using (is_active is not false or (select public.is_admin()));
create policy "admin write" on public.payment_accounts for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- reviews: everyone reads (name, stars, remark only), new reviews go through submit_review()
create policy "public read" on public.reviews for select using (true);
create policy "admin write" on public.reviews for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke select on public.reviews from anon, authenticated;
grant select (id, product_id, order_id, customer_name, rating, remark, created_at) on public.reviews to anon, authenticated;

-- private data: admins only
do $$
declare t text;
begin
  foreach t in array array['customers','orders','order_items','payments','notification_settings'] loop
    execute format('create policy "admin only" on public.%I for all using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- admin users and sessions: no direct access at all (only through the functions above)
revoke all on public.profiles from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;

-- ---------- 17. STARTING DATA ----------
insert into public.categories (name)
select v.name from (values ('Hair Care'), ('Bleach & Color'), ('Skin Care')) as v(name)
where not exists (select 1 from public.categories c where c.name = v.name);

-- First admin login, created ONLY on a brand-new database with no admin: zorima / zorima123
-- The website asks you to change it after the first login.
insert into public.profiles (username, password_hash, role)
select 'zorima', crypt('zorima123', gen_salt('bf')), 'Super Admin'
where not exists (select 1 from public.profiles p where p.username is not null and p.password_hash is not null);

insert into public.payment_accounts (type, account_number, account_title)
select * from (values
  ('EasyPaisa',   '0300-1234567',             'Zorima Official Account'),
  ('JazzCash',    '0300-7654321',             'Zorima Business Account'),
  ('UBL Bank',    'PK12-UBL-0000-1234-5678',  'Zorima UBL Account'),
  ('Meezan Bank', 'PK12-MEZN-0000-1234-5678', 'Zorima Meezan Account')
) as v(type, account_number, account_title)
where not exists (select 1 from public.payment_accounts);

-- Let the API see the new tables / columns
notify pgrst, 'reload schema';
