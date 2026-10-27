-- Sign-ups are closed: an account can only be created for an email listed in
-- private.allowed_emails (add rows with SQL; the email must be lowercase).
create table private.allowed_emails (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table private.allowed_emails enable row level security;

create function private.block_unlisted_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Sign-ups are closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.block_unlisted_signups() from public, anon, authenticated;

create trigger block_unlisted_signups
  before insert on auth.users
  for each row execute function private.block_unlisted_signups();
