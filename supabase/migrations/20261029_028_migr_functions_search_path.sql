-- The one-off import helpers in schema "migr" had no fixed search_path (Supabase security warning).
-- They only use built-in functions, so pinning the path changes nothing about their behaviour or any data.
alter function migr.parse_d(text) set search_path = pg_catalog;
alter function migr.try_jsonb(text) set search_path = pg_catalog;
