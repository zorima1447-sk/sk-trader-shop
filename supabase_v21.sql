-- ============================================================================
-- SK TRADER v21 - deleting a customer also deletes his login account
-- Run once in Supabase > SQL Editor (safe to run again).
-- ============================================================================

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

notify pgrst, 'reload schema';
