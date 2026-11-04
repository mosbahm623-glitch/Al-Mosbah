-- رسالة من الأدمن لمستخدمين يختارهم (الكل، المالك، المستخدمين، أو أشخاص بعينهم).
-- كل مستلم بيوصله إشعار عادي في التطبيق، ولو سجّل جهازه للإشعارات بيوصله على التليفون كمان
-- (نفس مسار الإشعارات الموجود: الـ trigger بتاع notifications هو اللي بيبعت).
-- الأدمن بس، والمستلمين لازم يكونوا حسابات مفعّلة. بترجّع عدد اللي اتبعتلهم.
create or replace function public.send_message(p_users uuid[], p_title text, p_body text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_count integer;
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'title length' using errcode = 'P0001';
  end if;
  if v_body is not null and char_length(v_body) > 500 then
    raise exception 'body length' using errcode = 'P0001';
  end if;

  insert into public.notifications (user_id, kind, title, body, url)
  select p.id, 'message', v_title, v_body, '#/notifications'
  from public.profiles p
  where p.is_active and p.id = any (coalesce(p_users, '{}'::uuid[]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.send_message(uuid[], text, text) from public, anon;
grant execute on function public.send_message(uuid[], text, text) to authenticated;
