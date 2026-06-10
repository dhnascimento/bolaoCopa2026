-- 0013_settings_pool_name.sql
-- Per-instance display name for the pool, admin-editable from the scoring page.
-- NULL → the app falls back to the localized default (common.appName). Lets a
-- forked instance name itself without any code change.
alter table public.settings add column if not exists pool_name text;
