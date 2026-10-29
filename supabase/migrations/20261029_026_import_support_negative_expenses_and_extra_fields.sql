-- Mirrors the migration "import_support_negative_expenses_and_extra_fields" that was applied straight to the live database.
-- Written to be re-runnable: on the live database every statement is a no-op, on a fresh one it builds the same shape.
--  * entries: optional entry_type / img_url / payment_method
--  * projects: optional dates, client phones and per-contractor phones
--  * expenses may be negative (a refund / correction); income stays > 0; zero is never allowed

alter table public.entries
  add column if not exists entry_type text,
  add column if not exists img_url text,
  add column if not exists payment_method text;

alter table public.projects
  add column if not exists start_date date,
  add column if not exists close_date date,
  add column if not exists client_phone text,
  add column if not exists client_phone2 text,
  add column if not exists contractor_phones jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entries'::regclass and conname = 'entries_amount_check'
      and pg_get_constraintdef(oid) like '%<> (0)%'
  ) then
    alter table public.entries drop constraint if exists entries_amount_check;
    alter table public.entries add constraint entries_amount_check
      check ((kind = 'expense' and amount <> 0) or (kind = 'income' and amount > 0));
  end if;
end $$;
