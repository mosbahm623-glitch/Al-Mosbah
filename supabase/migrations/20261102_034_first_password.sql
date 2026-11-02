-- كلمة السر اللي الأدمن بيحطها لمستخدم جديد مؤقتة: أول ما المستخدم يدخل لازم يعمل كلمة سر لنفسه.
alter table public.profiles add column must_change_password boolean not null default false;

-- accounts made by the admin are created already confirmed; self sign-ups wait for the email link, so they keep their own password
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, must_change_password)
  values (new.id, new.raw_user_meta_data ->> 'full_name', lower(new.email), new.email_confirmed_at is not null);
  return new;
end;
$$;

-- the user calls this right after he saved his own password
create or replace function public.password_changed()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where id = (select auth.uid());
$$;
revoke execute on function public.password_changed() from public, anon;
grant execute on function public.password_changed() to authenticated;
