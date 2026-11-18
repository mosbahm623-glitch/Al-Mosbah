-- Two people the security tests need: one active admin and one active ordinary user.
insert into private.allowed_emails (email) values ('admin@test.local'), ('user@test.local');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin@test.local', '{"full_name":"Admin"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'user@test.local', '{"full_name":"User"}');
update public.profiles set role = 'admin', is_active = true where id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set role = 'user', is_active = true where id = '00000000-0000-4000-8000-0000000000b1';
