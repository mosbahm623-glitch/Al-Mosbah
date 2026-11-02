-- Permissions take effect instantly: the app listens to these tables (row security: a user is only told about his own rows; staff about all).
alter publication supabase_realtime add table public.profiles, public.user_permissions, public.user_advance_access;
