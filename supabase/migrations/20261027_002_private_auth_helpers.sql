-- Keep RLS helper functions out of the public API schema (not callable via /rest/v1/rpc).
-- Policies reference the functions by OID, so moving them keeps every policy working.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_active_user() set schema private;
alter function public.is_admin() set schema private;
