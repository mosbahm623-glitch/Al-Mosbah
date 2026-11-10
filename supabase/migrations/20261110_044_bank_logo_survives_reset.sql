-- لوجو البنك ما يتمسحش حتى لو اتعمل «إعادة ضبط» للبنوك أو اتمسح البنك واتعمل من جديد.
-- اللوجوهات بتتحفظ كمان في جدول خاص (private.bank_logos) بالاسم، ومجموعات إعادة الضبط ما بتلمسوش.
-- أي بنك جديد بنفس الاسم من غير لوجو بياخد لوجوه المحفوظ لوحده.
create table if not exists private.bank_logos (
  name_key text primary key,
  logo text not null check (logo like 'data:image/%' and length(logo) <= 60000)
);
alter table private.bank_logos enable row level security;
revoke all on private.bank_logos from public, anon, authenticated;

-- قبل الإضافة: بنك من غير لوجو بياخد اللوجو المحفوظ باسمه
create or replace function private.bank_logo_restore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.logo is null then
    select l.logo into new.logo from private.bank_logos l where l.name_key = lower(btrim(new.name));
  end if;
  return new;
end;
$$;

-- بعد الإضافة أو التعديل: اللوجو بيتحفظ باسم البنك، ولو اتشال من البنك بنفسه بيتشال من المحفوظ
create or replace function private.bank_logo_remember()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.logo is not null then
    insert into private.bank_logos (name_key, logo) values (lower(btrim(new.name)), new.logo)
    on conflict (name_key) do update set logo = excluded.logo;
  elsif tg_op = 'UPDATE' then
    delete from private.bank_logos where name_key in (lower(btrim(old.name)), lower(btrim(new.name)));
  end if;
  return null;
end;
$$;

revoke execute on function private.bank_logo_restore() from public, anon, authenticated;
revoke execute on function private.bank_logo_remember() from public, anon, authenticated;

drop trigger if exists bank_logo_restore on public.bank_accounts;
create trigger bank_logo_restore
  before insert on public.bank_accounts
  for each row execute function private.bank_logo_restore();

drop trigger if exists bank_logo_remember on public.bank_accounts;
create trigger bank_logo_remember
  after insert or update of logo, name on public.bank_accounts
  for each row execute function private.bank_logo_remember();

-- اللوجوهات الموجودة دلوقتي تتحفظ (لو فيه)
insert into private.bank_logos (name_key, logo)
select lower(btrim(name)), logo from public.bank_accounts where logo is not null
on conflict (name_key) do nothing;
