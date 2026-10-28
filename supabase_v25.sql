-- ============================================================================
-- SK TRADER v25 - views / likes / comments on the blog list
-- Run once in Supabase > SQL Editor (safe to run again). Needs v23 first.
-- ============================================================================
-- Numbers on the blog list: views, likes, approved comments of every published article
create or replace function public.post_counts(p_visitor text default '')
returns table (slug text, views bigint, likes bigint, comments bigint, liked boolean)
language sql stable security definer
set search_path = public
as $$
  select p.slug,
    (select count(*) from public.site_events e where e.event = 'post_view' and e.path like '/blog/' || p.slug || '%'),
    (select count(*) from public.post_likes l where l.post_id = p.id),
    (select count(*) from public.post_comments c where c.post_id = p.id and c.approved),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.visitor_id = coalesce(p_visitor, ''))
  from public.site_posts p
  where p.kind = 'blog' and p.published
$$;
grant execute on function public.post_counts(text) to anon, authenticated;

notify pgrst, 'reload schema';
