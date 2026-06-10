-- Group label (A–L) for group-stage fixtures, to power the fixtures page group
-- filter. Knockout fixtures keep this null. Populated by the sync-fixtures Edge
-- Function from the API-Football `league.round` string ("Group A" → "A").
--
-- Additive, nullable column on an existing table — fixtures RLS is unchanged
-- (already readable by all authenticated users).
alter table public.fixtures add column if not exists group_label text;
