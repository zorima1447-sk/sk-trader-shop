-- ============================================================================
-- SK TRADER - VISITORS REPORT (run once in Supabase > SQL Editor, safe to run again)
-- Saves anonymous visits / product views / searches and gives the admin a report.
-- No IP address or personal data of normal visitors is stored: only a random
-- browser id, the page / product, the city (from Vercel) and the device type.
-- For logged-in customers their name and email are added to their own visits.
-- ============================================================================

create table if not exists public.site_events (
  id bigserial primary key,
  created_at timestamptz default now() not null,
  event text not null,          -- visit | product_view | add_to_cart | search | checkout | order
  visitor_id text,              -- random id kept in the visitor's own browser
  session_id text,              -- one visit (browser tab session)
  path text,
  product_id uuid,
  query text,                   -- what was searched
  referrer text,
  source text,                  -- whatsapp / facebook / instagram / google / tiktok / youtube / direct / other
  device text,                  -- mobile / tablet / desktop
  city text,
  region text,
  country text,
  user_id uuid,                 -- logged-in customer
  user_email text,
  user_name text
);
create index if not exists site_events_created_idx on public.site_events (created_at);
create index if not exists site_events_product_idx on public.site_events (product_id) where product_id is not null;
create index if not exists site_events_event_idx on public.site_events (event, created_at);

alter table public.site_events enable row level security;
-- nobody reads or writes the table directly; only through the two functions below
revoke all on public.site_events from anon, authenticated;

-- Called by the website (through /api/track on Vercel, which adds the city)
create or replace function public.track_event(p jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  em text;
  nm text;
  ev text := left(coalesce(p ->> 'event', ''), 20);
begin
  if ev not in ('visit', 'product_view', 'add_to_cart', 'search', 'checkout', 'order', 'post_view') then return; end if;
  if uid is not null then
    select u.email, nullif(coalesce(u.raw_user_meta_data ->> 'name', ''), '') into em, nm from auth.users u where u.id = uid;
  end if;
  insert into public.site_events (event, visitor_id, session_id, path, product_id, query, referrer, source, device,
                                  city, region, country, user_id, user_email, user_name)
  values (
    ev,
    left(p ->> 'visitor_id', 40),
    left(p ->> 'session_id', 40),
    left(p ->> 'path', 300),
    case when coalesce(p ->> 'product_id', '') ~ '^[0-9a-fA-F-]{36}$' then (p ->> 'product_id')::uuid end,
    left(nullif(trim(coalesce(p ->> 'query', '')), ''), 100),
    left(p ->> 'referrer', 300),
    left(p ->> 'source', 20),
    left(p ->> 'device', 10),
    left(nullif(p ->> 'city', ''), 60),
    left(nullif(p ->> 'region', ''), 60),
    left(nullif(p ->> 'country', ''), 5),
    uid, em, nm
  );
end $$;
grant execute on function public.track_event(jsonb) to anon, authenticated;

-- The admin report (Admin > Visitors Report)
create or replace function public.admin_visit_stats(p_days int default 30)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  today_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Karachi')) at time zone 'Asia/Karachi';
  res json;
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;

  with ev as (select * from public.site_events where created_at >= since)
  select json_build_object(
    'totals', (select json_build_object(
        'visitors',      count(distinct visitor_id),
        'visits',        count(distinct session_id),
        'page_views',    count(*) filter (where event = 'visit'),
        'product_views', count(*) filter (where event = 'product_view'),
        'add_to_cart',   count(*) filter (where event = 'add_to_cart'),
        'searches',      count(*) filter (where event = 'search'),
        'orders',        count(*) filter (where event = 'order'),
        'customers',     count(distinct user_id)
      ) from ev),
    'today', (select json_build_object(
        'visitors',      count(distinct visitor_id),
        'product_views', count(*) filter (where event = 'product_view'),
        'orders',        count(*) filter (where event = 'order')
      ) from public.site_events where created_at >= today_start),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select to_char((created_at at time zone 'Asia/Karachi')::date, 'YYYY-MM-DD') as day,
               count(distinct visitor_id) as visitors,
               count(*) filter (where event = 'product_view') as product_views,
               count(*) filter (where event = 'order') as orders
        from ev group by 1) d),
    'products', (select coalesce(json_agg(x order by x.views desc, x.carts desc), '[]'::json) from (
        select e.product_id, max(p.name) as name, max(p.image_url) as image_url,
               count(*) filter (where e.event = 'product_view') as views,
               count(distinct e.visitor_id) filter (where e.event = 'product_view') as viewers,
               count(*) filter (where e.event = 'add_to_cart') as carts,
               coalesce((select sum(oi.quantity) from public.order_items oi
                         where oi.product_id = e.product_id and oi.created_at >= since), 0) as sold
        from ev e left join public.products p on p.id = e.product_id
        where e.product_id is not null
        group by e.product_id
        order by 4 desc limit 40) x),
    'cities', (select coalesce(json_agg(c order by c.visitors desc), '[]'::json) from (
        select coalesce(city, 'Unknown') as name, max(country) as country, count(distinct visitor_id) as visitors
        from ev group by 1 order by 3 desc limit 25) c),
    'sources', (select coalesce(json_agg(s order by s.visitors desc), '[]'::json) from (
        select coalesce(source, 'direct') as name, count(distinct visitor_id) as visitors
        from ev where event = 'visit' group by 1) s),
    'devices', (select coalesce(json_agg(d order by d.visitors desc), '[]'::json) from (
        select coalesce(device, 'unknown') as name, count(distinct visitor_id) as visitors
        from ev where event = 'visit' group by 1) d),
    'searches', (select coalesce(json_agg(q order by q.times desc), '[]'::json) from (
        select lower(query) as query, count(*) as times
        from ev where event = 'search' and query is not null group by 1 order by 2 desc limit 25) q),
    'customers', (select coalesce(json_agg(u order by u.last_seen desc), '[]'::json) from (
        select e.user_id, max(e.user_name) as name, max(e.user_email) as email,
               count(*) filter (where e.event = 'product_view') as views,
               count(*) filter (where e.event = 'add_to_cart') as carts,
               count(*) filter (where e.event = 'order') as orders,
               max(e.created_at) as last_seen,
               max(e.city) as city,
               (select string_agg(distinct p2.name, ', ') from public.site_events e2 join public.products p2 on p2.id = e2.product_id
                 where e2.user_id = e.user_id and e2.event = 'product_view' and e2.created_at >= since) as viewed
        from ev e where e.user_id is not null
        group by e.user_id order by max(e.created_at) desc limit 40) u),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from (
        select e.created_at, e.event, e.city, e.device, e.source, e.query, e.user_name, e.user_email, p.name as product
        from ev e left join public.products p on p.id = e.product_id
        order by e.created_at desc limit 60) r)
  ) into res;
  return res;
end $$;
grant execute on function public.admin_visit_stats(int) to anon, authenticated;

notify pgrst, 'reload schema';
