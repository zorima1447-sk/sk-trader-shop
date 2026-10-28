-- ============================================================================
-- SK TRADER v24 - YouTube channel link (Store Profile)
-- Run once in Supabase > SQL Editor (safe to run again).
-- ============================================================================
alter table public.store_settings add column if not exists youtube text;
notify pgrst, 'reload schema';
