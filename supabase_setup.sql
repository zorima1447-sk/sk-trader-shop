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
  add column if not exists sold_quantity int default 0,
  add column if not exists variants jsonb,
  add column if not exists variant_label text;   -- what the options are called: Size, Shade, Color ...   -- sizes: [{"name":"500 ML","price":1850,"original_price":2100,"stock":20}, ...]

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
  add column if not exists area text,
  add column if not exists zip text,
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
  add column if not exists status text default 'Pending',
  -- online payment details given by the customer
  add column if not exists payment_account_id text,
  add column if not exists payment_account_label text,
  add column if not exists payer_name text,
  add column if not exists payer_account text,
  add column if not exists payer_amount numeric,
  add column if not exists payer_paid_at timestamptz,
  add column if not exists has_payment_proof boolean default false,
  add column if not exists customer_user_id uuid,   -- set when a logged-in customer orders
  add column if not exists subtotal numeric,
  add column if not exists delivery_charge numeric default 0,
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists area text,
  add column if not exists zip text,
  add column if not exists gst_rate numeric,
  add column if not exists gst_amount numeric default 0,
  add column if not exists gst_inclusive boolean,
  -- shipping / tracking (set by the admin)
  add column if not exists courier text,
  add column if not exists tracking_no text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists confirmed_at timestamptz;
create index if not exists orders_city_idx on public.orders(city);
create index if not exists orders_customer_user_id_idx on public.orders(customer_user_id);

-- Payment screenshots (kept apart so the order list stays light)
create table if not exists public.payment_proofs (
  order_id uuid primary key,
  image text,
  created_at timestamptz default now() not null
);

alter table public.orders
  alter column invoice_no set default ('ZP-' || nextval('public.invoice_seq'));

update public.orders set paid_amount = 0 where paid_amount is null;
alter table public.orders
  add column if not exists country_iso text default 'PK',
  add column if not exists country text default 'Pakistan';

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
  add column if not exists unit_price numeric default 0,
  add column if not exists variant text;

create index if not exists order_items_order_id_idx on public.order_items(order_id);
alter table public.order_items add column if not exists deal_items jsonb;  -- the products inside a deal line

-- ---------- 5b. DEALS (several products sold together for one price) ----------
create table if not exists public.deals (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Deal',
  description text,
  image_url text,
  items jsonb not null default '[]'::jsonb,   -- [{"product_id": "...", "variant": "500 ML" or null, "qty": 1}]
  deal_price numeric not null default 0,
  is_active boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now() not null
);
alter table public.deals
  add column if not exists starts_at timestamptz,   -- empty = starts at once
  add column if not exists ends_at timestamptz;     -- empty = no end; after this time the deal is gone

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
alter table public.notification_settings
  add column if not exists ntfy_enabled boolean default false,
  add column if not exists ntfy_topic text;
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
  add column if not exists notify_new_product boolean,
  add column if not exists show_marquee boolean,
  add column if not exists marquee_items jsonb,
  add column if not exists marquee_speed int,
  add column if not exists header_style text,
  add column if not exists page_bg text,
  add column if not exists delivery_karachi numeric,
  add column if not exists delivery_other numeric,
  add column if not exists free_delivery_over numeric,
  add column if not exists delivery_rates jsonb,    -- {"Punjab": 250, "Sindh": 200, ...}
  add column if not exists delivery_countries jsonb, -- {"AE": 4500, "GB": 6000, ...} charge per country (Rs.)
  add column if not exists ship_abroad boolean,      -- deliver to countries that are not in the list above
  add column if not exists delivery_abroad_other numeric,
  add column if not exists currencies_enabled boolean,
  add column if not exists currencies jsonb,         -- [{"code":"USD","symbol":"$","rate":280}] rate = Rs. for 1 unit
  add column if not exists currency_auto boolean,    -- take today's rates automatically
  add column if not exists currency_markup numeric,  -- % added to the rates (card / bank charges)
  add column if not exists cod_karachi_only boolean,
  add column if not exists invoice_prefix text,
  add column if not exists gst_enabled boolean,
  add column if not exists gst_rate numeric,
  add column if not exists gst_inclusive boolean,
  add column if not exists ntn text,
  add column if not exists strn text,
  add column if not exists ai_chat_enabled boolean,
  add column if not exists font_family text,
  add column if not exists font_scale int,
  add column if not exists search_shape text,
  add column if not exists search_button text,
  add column if not exists search_size text,
  add column if not exists search_placeholder text,
  add column if not exists categories_title text,
  add column if not exists show_brands boolean,
  add column if not exists brands_title text,
  add column if not exists brands jsonb,
  add column if not exists heading_font text,
  add column if not exists header_color text,
  add column if not exists page_bg_color text,
  add column if not exists strip_color text,
  add column if not exists strip_text_color text,
  add column if not exists topbar_color text,
  add column if not exists topbar_text_color text,
  add column if not exists footer_color text,
  add column if not exists brands_slide boolean,
  add column if not exists brands_speed int,
  add column if not exists show_flash boolean,
  add column if not exists flash_title text,
  add column if not exists flash_badge text,
  add column if not exists products_title text,
  add column if not exists trust_items jsonb,
  add column if not exists wa_title text,
  add column if not exists wa_text text,
  add column if not exists wa_button text,
  add column if not exists wa_message text,
  add column if not exists footer_links jsonb,
  add column if not exists footer_show_categories boolean,
  add column if not exists footer_show_payments boolean,
  add column if not exists quick_links_title text,
  add column if not exists payments_title text,
  add column if not exists deals_title text,
  add column if not exists deals_icon text,
  add column if not exists deals_icon_image text;

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
  -- Only new logo / banner images can be added; existing files cannot be replaced or deleted from the website.
  create policy "site-assets insert" on storage.objects for insert
    with check (bucket_id = 'site-assets' and name ~ '^(logo|slide|variant|product|blog)-[0-9a-z-]+\.(png|jpg)$');
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
-- Same for one size of a product (also lowers the product's total stock)
create or replace function public.decrement_variant_stock(p_id uuid, p_variant text, p_qty int)
returns void
language sql
set search_path = public
as $$
  update public.products
  set variants = (
        select jsonb_agg(
                 case when x.e ->> 'name' = p_variant
                      then jsonb_set(x.e, '{stock}', to_jsonb(greatest(coalesce((x.e ->> 'stock')::numeric, 0)::int - p_qty, 0)))
                      else x.e end
                 order by x.ord)
        from jsonb_array_elements(coalesce(variants, '[]'::jsonb)) with ordinality as x(e, ord)),
      stock_quantity = greatest(coalesce(stock_quantity, 0) - p_qty, 0),
      sold_quantity  = coalesce(sold_quantity, 0) + p_qty
  where id = p_id;
$$;

-- Only place_order() (below) may change stock; the website cannot call these directly any more.
revoke execute on function public.decrement_stock(uuid, int) from public, anon, authenticated;
revoke execute on function public.decrement_variant_stock(uuid, text, int) from public, anon, authenticated;

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
  online boolean;
  proof text;
  vname text;
  vrow jsonb;
  unit numeric;
  st public.store_settings;
  o_prov text;
  o_city text;
  o_ciso text;
  o_cname text;
  dc numeric := 0;
  g_rate numeric := null;
  g_amt numeric := 0;
  g_incl boolean := true;
  dl public.deals;
  dl_names text;
  di jsonb;
  eff jsonb;
  ditem jsonb;
  chosen text;
  xr record;
  cpr public.products;
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

    -- a deal: the deal price is charged, the stock of every item inside goes down
    if coalesce(it ->> 'deal_id', '') <> '' then
      select * into dl from public.deals where id = (it ->> 'deal_id')::uuid and is_active;
      if dl.id is null then raise exception 'A deal in your cart is no longer available.'; end if;
      if (dl.starts_at is not null and dl.starts_at > now()) or (dl.ends_at is not null and dl.ends_at <= now()) then
        raise exception 'The deal % has ended. Please remove it from your cart.', dl.name;
      end if;
      if jsonb_array_length(coalesce(dl.items, '[]'::jsonb)) = 0 then raise exception 'The deal % has no items.', dl.name; end if;
      if exists (select 1 from jsonb_array_elements(dl.items) x(e)
                 where not exists (select 1 from public.products p where p.id = (x.e ->> 'product_id')::uuid)) then
        raise exception 'A product of the deal % is no longer available.', dl.name;
      end if;
      -- items where the customer picks the colour / size: take his choice (checked against the product)
      eff := '[]'::jsonb;
      for xr in select x.e, x.ord from jsonb_array_elements(dl.items) with ordinality x(e, ord) loop
        ditem := xr.e;
        if coalesce((xr.e ->> 'choose')::boolean, false) then
          chosen := nullif(trim(coalesce(it -> 'choices' ->> ((xr.ord - 1)::text), '')), '');
          select * into cpr from public.products where id = (xr.e ->> 'product_id')::uuid;
          if chosen is null then
            raise exception 'Please choose the % for % in the deal %.', coalesce(nullif(cpr.variant_label, ''), 'option'), cpr.name, dl.name;
          end if;
          if not exists (select 1 from jsonb_array_elements(coalesce(cpr.variants, '[]'::jsonb)) v(e) where v.e ->> 'name' = chosen) then
            raise exception '% of % is no longer available.', chosen, cpr.name;
          end if;
          ditem := jsonb_set(xr.e - 'choose', '{variant}', to_jsonb(chosen));
        end if;
        eff := eff || jsonb_build_array(ditem);
      end loop;
      select string_agg(case when coalesce((x.e ->> 'qty')::int, 1) > 1 then (x.e ->> 'qty') || ' x ' else '' end
                        || p.name || coalesce(' - ' || nullif(x.e ->> 'variant', ''), ''), ', ' order by x.ord)
        into dl_names
        from jsonb_array_elements(eff) with ordinality x(e, ord)
        join public.products p on p.id = (x.e ->> 'product_id')::uuid;
      lines := lines || jsonb_build_object(
        'product_id', null,
        'product_name', 'DEAL: ' || dl.name || ' (' || coalesce(dl_names, '') || ')',
        'variant', null,
        'quantity', qty,
        'unit_price', dl.deal_price,
        'deal_items', eff
      );
      total := total + dl.deal_price * qty;
      continue;
    end if;

    select * into pr from public.products where id = (it ->> 'product_id')::uuid;
    if pr.id is null then raise exception 'A product in your cart is no longer available.'; end if;

    vname := nullif(trim(coalesce(it ->> 'variant', '')), '');
    if vname is not null then
      vrow := null;
      select x.e into vrow
      from jsonb_array_elements(coalesce(pr.variants, '[]'::jsonb)) as x(e)
      where x.e ->> 'name' = vname
      limit 1;
      if vrow is null then raise exception 'Size % of % is no longer available.', vname, pr.name; end if;
      unit := coalesce(nullif((vrow ->> 'price')::numeric, 0), 0);
    else
      unit := coalesce(nullif(pr.discounted_price, 0), pr.price, 0);
    end if;

    lines := lines || jsonb_build_object(
      'product_id', pr.id,
      'product_name', pr.name || coalesce(' - ' || vname, ''),
      'variant', vname,
      'quantity', qty,
      'unit_price', unit
    );
    total := total + unit * qty;
  end loop;

  -- save / update the customer (matched by phone number)
  begin
    if coalesce(p_customer ->> 'phone', '') <> '' then
      select id into cust_id from public.customers
      where phone_code = p_customer ->> 'phone_code' and phone = p_customer ->> 'phone'
      limit 1;
      if cust_id is null then
        insert into public.customers (name, email, phone_iso, phone_code, phone, country_iso, country,
                                      province_iso, province, city, address, area, zip, marketing_opt_in)
        values (p_customer ->> 'name', nullif(p_customer ->> 'email', ''), p_customer ->> 'phone_iso',
                p_customer ->> 'phone_code', p_customer ->> 'phone', p_customer ->> 'country_iso', p_customer ->> 'country',
                p_customer ->> 'province_iso', p_customer ->> 'province', p_customer ->> 'city', p_customer ->> 'address',
                p_customer ->> 'area', p_customer ->> 'zip',
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
          area = coalesce(p_customer ->> 'area', area), zip = coalesce(p_customer ->> 'zip', zip),
          marketing_opt_in = coalesce((p_customer ->> 'marketing_opt_in')::boolean, marketing_opt_in)
        where id = cust_id;
      end if;
    end if;
  exception when others then
    cust_id := null;  -- a customer-record problem must not block the order
  end;

  -- Delivery charge: Karachi city has its own charge, other cities use their province's charge
  o_prov := nullif(trim(coalesce(p_order ->> 'province', p_customer ->> 'province', '')), '');
  o_city := nullif(trim(coalesce(p_order ->> 'city', p_customer ->> 'city', '')), '');
  if o_city is null then raise exception 'Please select your city.'; end if;
  select * into st from public.store_settings where id = 1;
  -- Country: Pakistan unless the customer chose another country
  o_ciso := upper(left(coalesce(nullif(trim(coalesce(p_order ->> 'country_iso', p_customer ->> 'country_iso', '')), ''), 'PK'), 2));
  o_cname := left(coalesce(nullif(trim(coalesce(p_order ->> 'country', p_customer ->> 'country', '')), ''), case when o_ciso = 'PK' then 'Pakistan' else o_ciso end), 80);
  if o_ciso <> 'PK' then
    -- Delivery abroad: the country's own charge (Admin > Delivery Charges), else the charge for other countries
    if st.delivery_countries is not null and st.delivery_countries ? o_ciso
       and (st.delivery_countries ->> o_ciso) ~ '^[0-9]+(\.[0-9]+)?$' then
      dc := (st.delivery_countries ->> o_ciso)::numeric;
    elsif coalesce(st.ship_abroad, false) then
      dc := coalesce(st.delivery_abroad_other, 0);
    else
      raise exception 'Sorry, we do not deliver to % yet.', o_cname;
    end if;
    if coalesce(nullif(p_order ->> 'payment_method', ''), 'cod') = 'cod' then
      raise exception 'Cash on Delivery is only inside Pakistan. Please choose Online Payment.';
    end if;
  elsif coalesce(st.free_delivery_over, 0) > 0 and total >= st.free_delivery_over then
    dc := 0;
  elsif lower(o_city) = 'karachi' then
    dc := coalesce(st.delivery_karachi, 0);
  elsif st.delivery_rates is not null and st.delivery_rates ? coalesce(o_prov, '')
        and (st.delivery_rates ->> o_prov) ~ '^[0-9]+(\.[0-9]+)?$' then
    dc := (st.delivery_rates ->> o_prov)::numeric;
  else
    dc := coalesce(st.delivery_other, 250);
  end if;

  -- Sales tax (GST) on the goods, as set in Admin > Invoice & Tax
  if coalesce(st.gst_enabled, false) and coalesce(st.gst_rate, 0) > 0 then
    g_rate := st.gst_rate;
    g_incl := coalesce(st.gst_inclusive, true);
    g_amt := case when g_incl then round(total * g_rate / (100 + g_rate), 2)
                  else round(total * g_rate / 100, 2) end;
  end if;

  online := coalesce(nullif(p_order ->> 'payment_method', ''), 'cod') <> 'cod';
  if not online and o_ciso = 'PK' and coalesce(st.cod_karachi_only, true) and lower(o_city) <> 'karachi' then
    raise exception 'Cash on Delivery is only for Karachi. Please choose Online Payment.';
  end if;
  proof := case when online and left(coalesce(p_order ->> 'payment_proof', ''), 11) = 'data:image/'
                     and length(p_order ->> 'payment_proof') < 3000000
                then p_order ->> 'payment_proof' end;

  insert into public.orders (invoice_no, customer_id, customer_name, customer_phone, customer_email, shipping_address,
                             total_amount, payment_method, payment_status, paid_amount, transaction_id, status,
                             payment_account_id, payment_account_label, payer_name, payer_account, payer_amount,
                             payer_paid_at, has_payment_proof, customer_user_id,
                             subtotal, delivery_charge, province, city, area, zip, gst_rate, gst_amount, gst_inclusive,
                             country_iso, country)
  values (upper(coalesce(nullif(trim(st.invoice_prefix), ''), 'SK')) || '-' || to_char(now() at time zone 'Asia/Karachi', 'YYMMDD')
            || '-' || nextval('public.invoice_seq'),
          cust_id, trim(p_order ->> 'customer_name'), p_order ->> 'customer_phone',
          nullif(trim(coalesce(p_order ->> 'customer_email', '')), ''), p_order ->> 'shipping_address',
          total + dc + case when g_incl then 0 else g_amt end, left(coalesce(nullif(p_order ->> 'payment_method', ''), 'cod'), 40), 'Unpaid', 0,
          case when online then left(nullif(trim(coalesce(p_order ->> 'transaction_id', '')), ''), 80) end,
          'Pending',
          case when online then left(p_order ->> 'payment_account_id', 80) end,
          case when online then left(p_order ->> 'payment_account_label', 200) end,
          case when online then left(nullif(trim(coalesce(p_order ->> 'payer_name', '')), ''), 120) end,
          case when online then left(nullif(trim(coalesce(p_order ->> 'payer_account', '')), ''), 60) end,
          case when online and coalesce(p_order ->> 'payer_amount', '') ~ '^[0-9]+(\.[0-9]+)?$'
               then (p_order ->> 'payer_amount')::numeric end,
          case when online and coalesce(p_order ->> 'payer_paid_at', '') <> ''
               then (p_order ->> 'payer_paid_at')::timestamptz end,
          proof is not null, auth.uid(),
          total, dc, o_prov, o_city, left(nullif(trim(coalesce(p_order ->> 'area', '')), ''), 120),
          left(nullif(trim(coalesce(p_order ->> 'zip', '')), ''), 10),
          g_rate, g_amt, g_incl, o_ciso, o_cname)
  returning * into o;

  if proof is not null then
    insert into public.payment_proofs (order_id, image) values (o.id, proof);
  end if;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, variant, deal_items)
  select o.id, (l ->> 'product_id')::uuid, l ->> 'product_name', (l ->> 'quantity')::int, (l ->> 'unit_price')::numeric, l ->> 'variant',
         case when jsonb_typeof(l -> 'deal_items') = 'array' then l -> 'deal_items' end
  from jsonb_array_elements(lines) l;

  for it in select * from jsonb_array_elements(lines) loop
    if jsonb_typeof(it -> 'deal_items') = 'array' then
      for di in select * from jsonb_array_elements(it -> 'deal_items') loop
        if coalesce(di ->> 'variant', '') <> '' then
          perform public.decrement_variant_stock((di ->> 'product_id')::uuid, di ->> 'variant', (it ->> 'quantity')::int * coalesce((di ->> 'qty')::int, 1));
        else
          perform public.decrement_stock((di ->> 'product_id')::uuid, (it ->> 'quantity')::int * coalesce((di ->> 'qty')::int, 1));
        end if;
      end loop;
    elsif coalesce(it ->> 'variant', '') <> '' then
      perform public.decrement_variant_stock((it ->> 'product_id')::uuid, it ->> 'variant', (it ->> 'quantity')::int);
    else
      perform public.decrement_stock((it ->> 'product_id')::uuid, (it ->> 'quantity')::int);
    end if;
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


-- Admin: delete an order (optionally putting its items back in stock)
create or replace function public.admin_delete_order(p_id uuid, p_restock boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare it record;
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  if p_restock then
    for it in
      select product_id, variant, quantity from public.order_items where order_id = p_id and product_id is not null
      union all
      -- the products inside a deal line
      select (x.e ->> 'product_id')::uuid, nullif(x.e ->> 'variant', ''), i.quantity * coalesce((x.e ->> 'qty')::int, 1)
      from public.order_items i, jsonb_array_elements(i.deal_items) x(e)
      where i.order_id = p_id and jsonb_typeof(i.deal_items) = 'array'
    loop
      if coalesce(it.variant, '') <> '' then
        update public.products set
          variants = (select jsonb_agg(case when x.e ->> 'name' = it.variant
                                            then jsonb_set(x.e, '{stock}', to_jsonb(coalesce((x.e ->> 'stock')::numeric, 0)::int + it.quantity))
                                            else x.e end order by x.ord)
                      from jsonb_array_elements(coalesce(variants, '[]'::jsonb)) with ordinality as x(e, ord)),
          stock_quantity = coalesce(stock_quantity, 0) + it.quantity,
          sold_quantity = greatest(coalesce(sold_quantity, 0) - it.quantity, 0)
        where id = it.product_id;
      else
        update public.products set
          stock_quantity = coalesce(stock_quantity, 0) + it.quantity,
          sold_quantity = greatest(coalesce(sold_quantity, 0) - it.quantity, 0)
        where id = it.product_id;
      end if;
    end loop;
  end if;
  delete from public.payment_proofs where order_id = p_id;
  delete from public.payments where order_id = p_id;
  update public.reviews set order_id = null where order_id = p_id;
  delete from public.order_items where order_id = p_id;
  delete from public.orders where id = p_id;
end $$;

-- ---------- 15b. CUSTOMER ACCOUNTS (Supabase Auth) ----------
-- Customers sign up with email + password (Supabase Auth). Name and phone are kept in the
-- account's user_metadata. These functions give a customer only his own orders.

-- The customer's own orders with their items
create or replace function public.my_orders()
returns json
language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
  from (
    select o.id, o.invoice_no, o.created_at, o.total_amount, o.subtotal, o.delivery_charge, o.status, o.payment_status, o.payment_method,
           o.courier, o.tracking_no, o.tracking_url, o.shipped_at, o.confirmed_at,
           o.delivered_at, o.shipping_address,
           coalesce((select json_agg(json_build_object('product_name', i.product_name, 'quantity', i.quantity, 'unit_price', i.unit_price))
                     from public.order_items i where i.order_id = o.id), '[]'::json) as items
    from public.orders o
    where auth.uid() is not null and o.customer_user_id = auth.uid()
  ) x
$$;

-- Public order tracking: order number + last 4 digits of the order's mobile number.
-- Returns only what a customer needs (no address / email).
create or replace function public.track_order(p_order_no text, p_phone text)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'invoice_no', o.invoice_no, 'created_at', o.created_at, 'status', coalesce(o.status, 'Pending'),
    'confirmed_at', o.confirmed_at, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at,
    'city', o.city, 'total_amount', o.total_amount, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'courier', o.courier, 'tracking_no', o.tracking_no, 'tracking_url', o.tracking_url, 'order_id', o.id,
    'items', coalesce((select json_agg(json_build_object('product_name', i.product_name, 'quantity', i.quantity))
                       from public.order_items i where i.order_id = o.id), '[]'::json))
  from public.orders o
  where lower(o.invoice_no) = lower(trim(coalesce(p_order_no, '')))
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 4
    and right(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g'), 4)
        = right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 4)
  limit 1
$$;

-- Normalises a Pakistani phone number: 0300-1234567 / +92 300 1234567 -> 923001234567
create or replace function public.norm_phone(p text)
returns text
language sql immutable
as $$
  select case
    when d like '0%' then '92' || substr(d, 2)
    when length(d) = 10 and d like '3%' then '92' || d
    else d end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) t
$$;

-- Is this phone number already used by an account? (shown on the Register form)
create or replace function public.phone_registered(p_phone text)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select length(public.norm_phone(p_phone)) >= 10 and exists (
    select 1 from auth.users u where public.norm_phone(u.raw_user_meta_data ->> 'phone') = public.norm_phone(p_phone)
  )
$$;

-- ---------- PAGES & BLOG (About, Privacy Policy, Terms, Contact, blog articles) ----------
create table if not exists public.site_posts (
  id uuid default gen_random_uuid() primary key,
  kind text not null default 'blog',          -- 'page' (About, Privacy ...) or 'blog' (article)
  slug text not null unique,                  -- the link: /about, /blog/<slug>
  title text not null,
  description text,                           -- short summary for Google and the blog list
  cover_url text,                             -- main picture
  body text,                                  -- the text (rich text / HTML)
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_posts enable row level security;
drop policy if exists "site_posts read" on public.site_posts;
drop policy if exists "site_posts admin" on public.site_posts;
create policy "site_posts read" on public.site_posts for select using (published or public.is_admin());
create policy "site_posts admin" on public.site_posts for all using (public.is_admin()) with check (public.is_admin());
grant select on public.site_posts to anon, authenticated;
grant insert, update, delete on public.site_posts to anon, authenticated;

-- First content (only added when the page does not exist yet; your own changes are never overwritten)
insert into public.site_posts (kind, slug, title, description, body, sort_order) values
  ('page', 'about', $sk$About SK Trader$sk$, $sk$Learn about SK Trader, Karachi: authentic cosmetics, hair care and beauty products, wholesale and retail across Pakistan.$sk$, $sk$<p>Welcome to <b>SK Trader</b> (sktraderpk.com), your trusted partner for high-quality cosmetics, beauty and personal care products. Based in Karachi, Pakistan, we specialize in providing top-tier cosmetic solutions, including premium facial kits, Signature brand ranges, professional hair colors, masks and specialized shampoos.</p>
<h2>Our Mission</h2>
<p>At SK Trader, our mission is to deliver authentic, safe and effective beauty and hair care products to our customers and business partners. We aim to bridge the gap between quality cosmetic manufacturing and retail distribution, ensuring our clients receive the best results for their personal care needs.</p>
<h2>What We Offer</h2>
<ul>
<li><b>Cosmetics &amp; Facial Kits:</b> High-grade facial skincare products designed for glowing and healthy skin.</li>
<li><b>Hair Care Range:</b> Premium hair color shades, nourishing hair masks and repair shampoos.</li>
<li><b>Distribution &amp; Wholesale:</b> Reliable supply and distribution services for cosmetic brands.</li>
</ul>
<h2>Why Choose Us?</h2>
<ul>
<li>100% authentic and tested cosmetic formulations.</li>
<li>Dedicated customer support and reliable delivery across Pakistan.</li>
<li>Commitment to quality, safety and customer satisfaction.</li>
</ul>
<h2>Visit or Contact Us</h2>
<p><b>Business Office:</b> Office # 12, 3rd Floor, Zohra Plaza, Block 13-C, Gulshan-e-Iqbal, Main University Road, Karachi, Pakistan.<br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a><br><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a></p>$sk$, 1),
  ('page', 'contact', $sk$Contact Us$sk$, $sk$Contact SK Trader Karachi for orders, wholesale prices and product advice: phone, WhatsApp, email and office address.$sk$, $sk$<p>We are happy to help with orders, wholesale prices, delivery and product advice. Send us a message on WhatsApp, call us or email us. You can also visit our office.</p>
<h2>Business Office</h2>
<p>Office # 12, 3rd Floor, Zohra Plaza, Block 13-C, Gulshan-e-Iqbal, Main University Road, Karachi, Pakistan.</p>
<h2>Phone &amp; Email</h2>
<p><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a><br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a></p>
<h2>Wholesale &amp; Business Enquiries</h2>
<p>Salons, beauty shops and resellers are welcome. Contact us for wholesale prices and regular supply.</p>$sk$, 2),
  ('page', 'privacy-policy', $sk$Privacy Policy$sk$, $sk$Privacy Policy of SK Trader (sktraderpk.com): what information we collect, how we use it, cookies and Google AdSense.$sk$, $sk$<p><b>Effective Date:</b> October 2026<br><b>Website:</b> <a href="https://www.sktraderpk.com">https://www.sktraderpk.com</a></p>
<p>At SK Trader, accessible from sktraderpk.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains the types of information that are collected and recorded by SK Trader and how we use them.</p>
<h2>1. Information We Collect</h2>
<p>When you visit or make a purchase on sktraderpk.com, we may collect personal information such as:</p>
<ul>
<li>Name, shipping address and phone number for order fulfillment.</li>
<li>Email address for order tracking and inquiries.</li>
<li>Log files (IP address, browser type, ISP, date/time stamp, referring pages).</li>
<li>Anonymous visit statistics (pages and products viewed, city, device type) to improve our shop.</li>
</ul>
<h2>2. How We Use Your Information</h2>
<p>We use the collected information to:</p>
<ul>
<li>Process and deliver your orders for cosmetic and hair care products.</li>
<li>Improve, personalize and expand our website services.</li>
<li>Communicate with you regarding order updates or customer support.</li>
<li>Prevent fraudulent transactions and ensure website security.</li>
</ul>
<h2>3. Third-Party Advertising &amp; Cookies (Google AdSense)</h2>
<ul>
<li><b>Cookies:</b> SK Trader uses cookies and similar browser storage to store information including visitors' preferences (for example your cart and chosen currency) and the pages on the website that the visitor accessed or visited.</li>
<li><b>Google DoubleClick DART Cookie:</b> Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to sktraderpk.com and other sites on the internet.</li>
<li>Visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">https://policies.google.com/technologies/ads</a></li>
</ul>
<h2>4. Third-Party Privacy Policies</h2>
<p>SK Trader's Privacy Policy does not apply to other advertisers or websites. Thus, we advise you to consult the respective Privacy Policies of these third-party ad servers (such as Google AdSense) for more detailed information.</p>
<h2>5. Contact Us</h2>
<p>If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a>.</p>$sk$, 3),
  ('page', 'terms-and-conditions', $sk$Terms and Conditions$sk$, $sk$Terms and Conditions for using sktraderpk.com and ordering cosmetic and hair care products from SK Trader.$sk$, $sk$<p><b>Effective Date:</b> October 2026<br><b>Website:</b> <a href="https://www.sktraderpk.com">https://www.sktraderpk.com</a></p>
<p>Welcome to SK Trader! These terms and conditions outline the rules and regulations for the use of SK Trader's website, located at sktraderpk.com.</p>
<h2>1. Intellectual Property Rights</h2>
<p>Unless otherwise stated, SK Trader and/or its licensors own the intellectual property rights for all material on sktraderpk.com. All intellectual property rights are reserved.</p>
<h2>2. Products and Orders</h2>
<ul>
<li><b>Product Information:</b> We strive to display the colors, descriptions and packaging of our cosmetic and hair care products as accurately as possible.</li>
<li><b>Pricing &amp; Availability:</b> All prices and product availability are subject to change without prior notice.</li>
<li><b>Order Acceptance:</b> We reserve the right to refuse or cancel any order for reasons including inventory stock, errors in pricing or suspected unauthorized transactions.</li>
</ul>
<h2>3. User Responsibilities</h2>
<p>You must not:</p>
<ul>
<li>Republish material from sktraderpk.com without permission.</li>
<li>Sell, rent or sub-license material from sktraderpk.com.</li>
<li>Use this website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website.</li>
</ul>
<h2>4. Limitation of Liability</h2>
<p>In no event shall SK Trader, nor any of its officers, directors and employees, be held liable for anything arising out of or in any way connected with your use of this website.</p>
<h2>5. Governing Law</h2>
<p>These terms and conditions are governed by and construed in accordance with the laws of Pakistan.</p>
<h2>6. Contact Information</h2>
<p>If you have any questions regarding these Terms, please contact us at:<br><b>Email:</b> <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a><br><b>Phone:</b> <a href="tel:+923001550311">+92 300 1550311</a></p>$sk$, 4),
  ('blog', 'baalon-ka-girna-kaise-rokein-hair-fall-control', $sk$Baalon Ka Girna Kaise Rokein? Hair Fall Control Aur Repair Ka Sahi Tareeqa$sk$, $sk$Hair fall kyun hota hai aur baalon ko majboot kaise banayein: shampoo, hair mask, oiling aur diet ke aasan aur asar-daar tareeqay.$sk$, $sk$<p>Aaj kal badalte mausam, ziyada tension, aur ghalat shampoo ya chemical products use karne ki wajah se baalon ka girna (hair fall) ek aam masla ban chuka hai. Chahe mard hon ya aurtein, har koi baalon ke patle hone aur girne se pareshan rehta hai.</p>
<p>Lekin achhi baat yeh hai ke agar aap waqt par apne baalon ki sahi hifazat (hair care routine) shuru kar dein, to hair fall ko na sirf roka ja sakta hai balki baalon ki growth ko bhi dobara behtar banaya ja sakta hai. Is article mein hum baat karenge un aasan aur asar-daar tareeqon ki jin se aap apne baal majboot bana sakte hain.</p>
<h2>1. Hair Fall Kyun Hota Hai? (Buniyaadi Wajoohaat)</h2>
<p>Baalon ke girne ki sab se bari wajahein yeh hoti hain:</p>
<ul>
<li><b>Severe Dandruff &amp; Scalp Dryness:</b> Agar sar mein khushki ho to baalon ki jarein (roots) kamzor ho jati hain.</li>
<li><b>Harsh Chemical Shampoos:</b> Aise shampoos jin mein harmful sulfates hote hain, woh baalon ka natural moisture khatam kar dete hain.</li>
<li><b>Nutritional Deficiency:</b> Khane mein proteins aur vitamins ki kami.</li>
</ul>
<h2>2. Baalon Ko Majboot Banane Ke Zaroori Steps</h2>
<h3>Step 1: Scalp Ko Saaf Aur Hydrated Rakhein</h3>
<p>Aap ka scalp jitna clean aur khushki-free rahega, baal utne hi kam girenge. Is ke liye hafte mein 2 se 3 baar ek achha nourishing shampoo use karein jo baalon ko dry kiye baghair saaf kare.</p>
<h3>Step 2: Hair Mask Ka Use Karein (Deep Conditioning)</h3>
<p>Sirf shampoo lagana kaafi nahi hota. Hair mask baalon ki deep conditioning karta hai aur damaged baalon ko repair kar ke unhein tootne se bachata hai. Hafte mein ek baar hair mask zaroor lagayein.</p>
<p>[[products: shampoo, mask | Kya Aap Baal Girne Aur Dryness Se Pareshan Hain? SK Trader ki Nourishing Shampoo &amp; Hair Repair Mask range dekhein]]</p>
<h2>3. Natural Tips Jo Aap Ghar Par Kar Sakte Hain</h2>
<ul>
<li><b>Gentle Oiling:</b> Hafte mein ek se do baar halki oiling (coconut ya almond oil) karein.</li>
<li><b>Heat Styling Se Bachein:</b> Hair dryer aur straightener ka ziyada use baalon ko kamzor karta hai.</li>
<li><b>Diet Behtar Karein:</b> Apni khuraak mein anda, doodh aur hari sabziyan shamil karein.</li>
</ul>
<h2>Khulasa (Conclusion)</h2>
<p>Hair fall ko control karna ek din ka kaam nahi hai, is ke liye regular care ki zaroorat hoti hai. Sahi hair care products ka intekhab karein aur chemical-heavy shampoos se parhez karein. Agar aap apne baalon ko sahi nourishment denge to kuch hi hafton mein aap ko baalon ki strength mein numayan farq dikhai dega.</p>
<p><i>Note: Agar baal bohat tezi se gir rahe hon ya jagah jagah se ganjapan ho, to kisi skin specialist (dermatologist) se zaroor mashwara karein.</i></p>$sk$, 0)

on conflict (slug) do nothing;

-- Google AdSense publisher ID (ca-pub-...) - Admin > Blog & Pages
alter table public.store_settings add column if not exists adsense_client text;

-- ---------- CUSTOMER LOGIN ACCOUNTS (Admin > Customers) ----------
-- The login accounts (Register / Login) of customers, for the admin list
create or replace function public.admin_customer_accounts()
returns table (id uuid, email text, name text, phone text, city text, country text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return query
    select u.id, u.email::text, (u.raw_user_meta_data ->> 'name')::text, (u.raw_user_meta_data ->> 'phone')::text,
           (u.raw_user_meta_data ->> 'city')::text, coalesce(u.raw_user_meta_data ->> 'country_name', 'Pakistan')::text,
           u.created_at, u.last_sign_in_at
    from auth.users u
    order by u.created_at desc;
end $$;
grant execute on function public.admin_customer_accounts() to anon, authenticated;

-- Delete one login account. The customer can then register again with the same number / email.
-- His past orders stay.
create or replace function public.admin_delete_account(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  delete from auth.users where id = p_user_id;
end $$;
grant execute on function public.admin_delete_account(uuid) to anon, authenticated;

-- Delete a customer: his customer record AND his login account (same mobile number or email).
-- Returns how many login accounts were removed. Past orders stay.
create or replace function public.admin_delete_customer(p_id uuid)
returns int
language plpgsql security definer
set search_path = public, auth
as $$
declare
  c public.customers;
  ph text;
  n int := 0;
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  select * into c from public.customers where id = p_id;
  if c.id is null then return 0; end if;
  ph := public.norm_phone(coalesce(c.phone_code, '') || coalesce(c.phone, ''));
  delete from public.customers where id = p_id;
  with gone as (
    delete from auth.users u
    where (length(ph) >= 10 and public.norm_phone(u.raw_user_meta_data ->> 'phone') = ph)
       or (coalesce(c.email, '') <> '' and lower(u.email) = lower(c.email))
    returning 1
  ) select count(*) into n from gone;
  return n;
end $$;
grant execute on function public.admin_delete_customer(uuid) to anon, authenticated;

-- Login with phone number: only the Edge Function "customer-login" (service role) may call this.
create or replace function public.email_for_phone(p_phone text)
returns text
language sql stable security definer
set search_path = public, auth
as $$
  select u.email from auth.users u
  where length(public.norm_phone(p_phone)) >= 10
    and public.norm_phone(u.raw_user_meta_data ->> 'phone') = public.norm_phone(p_phone)
  order by u.created_at
  limit 1
$$;
revoke execute on function public.email_for_phone(text) from public, anon, authenticated;
do $$ begin
  grant execute on function public.email_for_phone(text) to service_role;
exception when undefined_object then null;
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
alter table public.payment_proofs        enable row level security;
alter table public.deals                 enable row level security;

-- remove every old policy on these tables (including the old "Allow All")
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('categories','products','customers','orders','order_items','payments','reviews','profiles',
                        'payment_accounts','notification_settings','hero_slides','store_settings','admin_sessions','payment_proofs','deals')
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

-- deals: everyone sees the active ones, admins see and change all
create policy "public read active" on public.deals for select
  using (is_active or (select public.is_admin()));
create policy "admin write" on public.deals for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update, delete on public.deals to anon, authenticated;

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
  foreach t in array array['customers','orders','order_items','payments','notification_settings','payment_proofs'] loop
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
