-- ============================================================================
-- SK TRADER v23 - blog likes / comments / translations, returns, AdSense places
-- Run once in Supabase > SQL Editor (safe to run again).
-- ============================================================================

-- ---------- BLOG: translations, likes, comments ----------
alter table public.site_posts add column if not exists translations jsonb;   -- {"en": {"title","description","body"}, "ur": {...}, "hi": {...}}

create table if not exists public.post_likes (
  post_id uuid not null references public.site_posts(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, visitor_id)
);
alter table public.post_likes enable row level security;
revoke all on public.post_likes from anon, authenticated;

create table if not exists public.post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.site_posts(id) on delete cascade,
  name text not null,
  body text not null,
  visitor_id text,
  user_id uuid,
  approved boolean not null default false,     -- shown on the website only after the admin approves it
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
revoke all on public.post_comments from anon, authenticated;

-- What a reader sees under an article: views, likes, approved comments
create or replace function public.post_public(p_slug text, p_visitor text default '')
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  p public.site_posts;
begin
  select * into p from public.site_posts where slug = lower(p_slug) and kind = 'blog' and published;
  if p.id is null then return null; end if;
  return json_build_object(
    'views', (select count(*) from public.site_events e where e.event = 'post_view' and e.path like '/blog/' || p.slug || '%'),
    'likes', (select count(*) from public.post_likes l where l.post_id = p.id),
    'liked', exists (select 1 from public.post_likes l where l.post_id = p.id and l.visitor_id = coalesce(p_visitor, '')),
    'comments', (select coalesce(json_agg(json_build_object('name', c.name, 'body', c.body, 'created_at', c.created_at) order by c.created_at), '[]'::json)
                 from public.post_comments c where c.post_id = p.id and c.approved)
  );
end $$;
grant execute on function public.post_public(text, text) to anon, authenticated;

-- Like / unlike (one like per browser)
create or replace function public.post_like(p_slug text, p_visitor text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
  v text := left(coalesce(p_visitor, ''), 40);
  liked boolean;
begin
  if length(v) < 6 then raise exception 'Please allow the website to save data in your browser.'; end if;
  select id into pid from public.site_posts where slug = lower(p_slug) and kind = 'blog' and published;
  if pid is null then raise exception 'Article not found.'; end if;
  if exists (select 1 from public.post_likes where post_id = pid and visitor_id = v) then
    delete from public.post_likes where post_id = pid and visitor_id = v; liked := false;
  else
    insert into public.post_likes (post_id, visitor_id) values (pid, v); liked := true;
  end if;
  return json_build_object('liked', liked, 'likes', (select count(*) from public.post_likes where post_id = pid));
end $$;
grant execute on function public.post_like(text, text) to anon, authenticated;

-- Write a comment (waits for the admin's approval; max 3 per hour from one browser)
create or replace function public.post_comment(p_slug text, p_name text, p_body text, p_visitor text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
  v text := left(coalesce(p_visitor, ''), 40);
  nm text := left(trim(coalesce(p_name, '')), 60);
  bd text := left(trim(coalesce(p_body, '')), 1500);
begin
  if nm = '' then raise exception 'Please write your name.'; end if;
  if length(bd) < 3 then raise exception 'Please write your comment.'; end if;
  if bd ~* '(https?://|www\.)' then raise exception 'Links are not allowed in comments.'; end if;
  select id into pid from public.site_posts where slug = lower(p_slug) and kind = 'blog' and published;
  if pid is null then raise exception 'Article not found.'; end if;
  if (select count(*) from public.post_comments where visitor_id = v and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many comments. Please try again later.';
  end if;
  insert into public.post_comments (post_id, name, body, visitor_id, user_id) values (pid, nm, bd, v, auth.uid());
  return json_build_object('ok', true);
end $$;
grant execute on function public.post_comment(text, text, text, text) to anon, authenticated;

-- Admin: numbers per article (Visitors Report and Blog & Pages)
create or replace function public.admin_blog_stats(p_days int default 30)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return (select coalesce(json_agg(x order by x.views desc), '[]'::json) from (
    select p.id, p.slug, p.title, p.published,
      (select count(*) from public.site_events e where e.event = 'post_view' and e.path like '/blog/' || p.slug || '%' and e.created_at >= since) as views,
      (select count(distinct e.visitor_id) from public.site_events e where e.event = 'post_view' and e.path like '/blog/' || p.slug || '%' and e.created_at >= since) as readers,
      (select count(*) from public.site_events e where e.event = 'post_view' and e.path like '/blog/' || p.slug || '%') as views_all,
      (select count(*) from public.post_likes l where l.post_id = p.id) as likes,
      (select count(*) from public.post_comments c where c.post_id = p.id and c.approved) as comments,
      (select count(*) from public.post_comments c where c.post_id = p.id and not c.approved) as pending
    from public.site_posts p where p.kind = 'blog') x);
end $$;
grant execute on function public.admin_blog_stats(int) to anon, authenticated;

-- Admin: all comments
create or replace function public.admin_comments()
returns table (id uuid, post_title text, post_slug text, name text, body text, approved boolean, created_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  return query select c.id, p.title, p.slug, c.name, c.body, c.approved, c.created_at
    from public.post_comments c join public.site_posts p on p.id = c.post_id
    order by c.approved, c.created_at desc limit 300;
end $$;
grant execute on function public.admin_comments() to anon, authenticated;

create or replace function public.admin_comment_set(p_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin login required.'; end if;
  if p_approved is null then delete from public.post_comments where id = p_id;
  else update public.post_comments set approved = p_approved where id = p_id; end if;
end $$;
grant execute on function public.admin_comment_set(uuid, boolean) to anon, authenticated;

-- ---------- RETURNS ----------
alter table public.store_settings
  add column if not exists return_days int,           -- days after delivery a return can be requested (default 7)
  add column if not exists ads_place text,            -- 'blog' (ads only on blog & info pages) or 'all'
  add column if not exists adsense_slot text;         -- optional ad unit ID for the ad inside articles

create table if not exists public.return_requests (
  id uuid default gen_random_uuid() primary key,
  ref text unique,                                   -- R-<invoice>-n shown to the customer
  order_id uuid,
  invoice_no text,
  customer_name text,
  customer_phone text,
  items jsonb,                                       -- [{"product_name","variant","quantity"}]
  reason text,
  details text,
  resolution text,                                   -- what the customer wants: refund / exchange
  status text not null default 'Requested',          -- Requested, Approved, Rejected, Received, Refunded, Exchanged
  refund_amount numeric,
  admin_note text,                                   -- message shown to the customer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.return_requests enable row level security;
drop policy if exists "returns admin" on public.return_requests;
create policy "returns admin" on public.return_requests for all using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.return_requests to anon, authenticated;

-- Customer: find his order (order number + mobile number) for the return form
create or replace function public.return_lookup(p_invoice text, p_phone text)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  o public.orders;
  days int;
  since timestamptz;
begin
  select * into o from public.orders
   where upper(invoice_no) = upper(trim(p_invoice))
     and right(regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g'), 9) = right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9)
   limit 1;
  if o.id is null then raise exception 'Order not found. Please check the order number and the mobile number used for the order.'; end if;
  select coalesce(return_days, 7) into days from public.store_settings where id = 1;
  since := coalesce(o.delivered_at, o.shipped_at, o.created_at);
  return json_build_object(
    'invoice_no', o.invoice_no, 'customer_name', o.customer_name, 'status', o.status, 'created_at', o.created_at,
    'return_until', since + make_interval(days => coalesce(days, 7) + case when o.delivered_at is null then 5 else 0 end),
    'can_return', o.status <> 'Cancelled' and now() <= since + make_interval(days => coalesce(days, 7) + case when o.delivered_at is null then 5 else 0 end),
    'items', (select coalesce(json_agg(json_build_object('product_name', i.product_name, 'variant', i.variant, 'quantity', i.quantity) order by i.created_at), '[]'::json)
              from public.order_items i where i.order_id = o.id),
    'requests', (select coalesce(json_agg(json_build_object('ref', r.ref, 'status', r.status, 'reason', r.reason, 'admin_note', r.admin_note,
                                                       'refund_amount', r.refund_amount, 'created_at', r.created_at, 'items', r.items) order by r.created_at desc), '[]'::json)
                 from public.return_requests r where r.order_id = o.id)
  );
end $$;
grant execute on function public.return_lookup(text, text) to anon, authenticated;

-- Customer: send the return request
create or replace function public.request_return(p_invoice text, p_phone text, p_items jsonb, p_reason text, p_details text, p_resolution text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  info json;
  o public.orders;
  n int;
  r public.return_requests;
begin
  info := public.return_lookup(p_invoice, p_phone);
  if not coalesce((info ->> 'can_return')::boolean, false) then
    raise exception 'The time to return this order is over (or the order was cancelled). Please contact us on WhatsApp.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Please choose the items to return.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please choose a reason.'; end if;
  select * into o from public.orders where upper(invoice_no) = upper(trim(p_invoice)) limit 1;
  if (select count(*) from public.return_requests where order_id = o.id and status in ('Requested', 'Approved')) > 0 then
    raise exception 'A return request for this order is already open. We will contact you soon.';
  end if;
  select count(*) + 1 into n from public.return_requests where order_id = o.id;
  insert into public.return_requests (ref, order_id, invoice_no, customer_name, customer_phone, items, reason, details, resolution)
  values ('R-' || o.invoice_no || '-' || n, o.id, o.invoice_no, o.customer_name, o.customer_phone,
          (select jsonb_agg(x) from (select * from jsonb_array_elements(p_items) limit 50) t(x)),
          left(trim(p_reason), 120), left(trim(coalesce(p_details, '')), 1500), left(coalesce(p_resolution, ''), 40))
  returning * into r;
  return json_build_object('ref', r.ref, 'status', r.status);
end $$;
grant execute on function public.request_return(text, text, jsonb, text, text, text) to anon, authenticated;

-- Return policy page (only added if it does not exist yet)
insert into public.site_posts (kind, slug, title, description, body, sort_order) values
  ('page', 'returns', 'Return & Refund Policy', 'SK Trader return and refund policy: damaged, wrong or missing products, time limit, refunds and exchanges. Request a return online.', $sk$<p>We want you to be happy with every order from SK Trader. If something is wrong with your order, we will make it right.</p>
<h2>1. When can you return a product?</h2>
<ul>
<li>You received a <b>damaged, broken or leaking</b> product.</li>
<li>You received the <b>wrong product, shade or size</b>.</li>
<li>A product is <b>missing</b> from your parcel.</li>
<li>The product is <b>expired</b>.</li>
</ul>
<h2>2. Time limit</h2>
<p>Please request the return within <b>7 days</b> of receiving your order. Keep the parcel, the box and the invoice. A short video of opening the parcel helps us solve the problem quickly.</p>
<h2>3. Products that cannot be returned</h2>
<p>For hygiene and safety, cosmetic and hair care products that have been <b>opened, used or had their seal removed</b> cannot be returned, unless they were damaged or wrong when they arrived. We also cannot accept returns because of a change of mind after use, or skin / hair reactions; please always do a patch test first.</p>
<h2>4. How to request a return</h2>
<ol>
<li>Fill in the form below with your order number and mobile number.</li>
<li>Choose the items and the reason, and add photos on WhatsApp if needed.</li>
<li>Our team checks your request within 1-2 working days and tells you what to do next.</li>
</ol>
<h2>5. Refund or exchange</h2>
<ul>
<li>After we receive and check the returned product, we send a <b>replacement</b> or a <b>refund</b>.</li>
<li>Refunds are sent to your bank account, EasyPaisa or JazzCash within 3-7 working days.</li>
<li>If the mistake was ours (damaged / wrong / missing / expired), we pay the delivery charges. Otherwise the return delivery charge is paid by the customer.</li>
</ul>
<h2>6. Contact</h2>
<p>Questions? Email <a href="mailto:info@sktraderpk.com">info@sktraderpk.com</a> or call / WhatsApp <a href="tel:+923001550311">+92 300 1550311</a>.</p>$sk$, 5)
on conflict (slug) do nothing;

-- Count article views in the Visitors Report
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

notify pgrst, 'reload schema';
