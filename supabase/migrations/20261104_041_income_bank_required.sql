-- أي قيد (وارد أو مصروف، من أي مستخدم) لازم يكون له بنك. الاستثناء: قيود العهد (مفيهاش بنك أصلًا)، والقيد القديم من غير بنك
-- لو اتعدّل من غير ما يتحط له بنك (زي الموافقة عليه)، وأي نداء من غير مستخدم (قاعدة البيانات نفسها).
create or replace function private.entry_bank_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'owner') then
    if new.bank_id is null and new.advance_id is null and not (tg_op = 'UPDATE' and old.bank_id is null) then
      raise exception 'bank required' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.bank_id is null then
    if new.advance_id is not null or (tg_op = 'UPDATE' and old.bank_id is null) then
      return new;
    end if;
    raise exception 'bank required' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.bank_id is not distinct from old.bank_id then
    return new;
  end if;
  if not exists (select 1 from public.user_bank_access where user_id = uid and bank_id = new.bank_id) then
    raise exception 'bank not allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.entry_bank_access() from public, anon, authenticated;
