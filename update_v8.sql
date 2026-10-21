-- SK Trader Shop v8 update (run once in Supabase > SQL Editor; safe to run again)
-- 1. Settings for the scrolling strip under the banner
alter table public.store_settings
  add column if not exists show_marquee boolean,
  add column if not exists marquee_items jsonb,
  add column if not exists marquee_speed int;

-- 2. Allow banner images (slide-*.jpg) as well as logos in the site-assets bucket
do $$
begin
  drop policy if exists "site-assets insert" on storage.objects;
  create policy "site-assets insert" on storage.objects for insert
    with check (bucket_id = 'site-assets' and name ~ '^(logo|slide)-[0-9a-z-]+\.(png|jpg)$');
exception when others then
  raise notice 'Storage policy skipped: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
