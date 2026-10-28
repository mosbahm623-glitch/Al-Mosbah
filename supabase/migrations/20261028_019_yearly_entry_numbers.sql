-- Entry numbers are YYYY + a 4-digit counter that restarts every year: 20260001, 20260002 ... 20270001 ...
-- The counter row is locked while an entry is inserted, so two people saving at once still get different numbers,
-- and a failed save gives its number back (no holes). The year is the year it was recorded, Cairo time.
create table public.entry_counters (year integer primary key, last integer not null default 0);
alter table public.entry_counters enable row level security; -- no policies: only the trigger below touches it

alter table public.entries alter column seq drop identity;

-- renumber what exists, in the old order, per year of recording
alter table public.entries disable trigger entry_approval_flow;
update public.entries e
   set seq = n.new_seq
  from (
    select id,
           extract(year from created_at at time zone 'Africa/Cairo')::int * 10000
             + row_number() over (partition by extract(year from created_at at time zone 'Africa/Cairo') order by seq) as new_seq
      from public.entries
  ) n
 where n.id = e.id;
alter table public.entries enable trigger entry_approval_flow;

insert into public.entry_counters (year, last)
select seq / 10000, max(seq % 10000) from public.entries group by 1;

drop sequence if exists public.entries_seq_seq;

create or replace function private.entry_approval_flow()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  y integer;
  n integer;
begin
  if tg_op = 'INSERT' then
    y := extract(year from now() at time zone 'Africa/Cairo')::int;
    insert into public.entry_counters as c (year, last) values (y, 1)
      on conflict (year) do update set last = c.last + 1
      returning c.last into n;
    if n > 9999 then
      raise exception 'entry numbers of % are used up (9999)', y;
    end if;
    new.seq := y * 10000 + n;
    new.rev := 1;
    new.created_by := (select auth.uid());
    new.decided_by := null;
    new.decided_at := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
    new.seq := old.seq;
    new.rev := old.rev + 1;
    new.created_by := old.created_by;
    if private.is_admin() or (select auth.uid()) is null then
      if new.status is distinct from old.status then
        new.decided_by := (select auth.uid());
        new.decided_at := now();
      else
        new.decided_by := old.decided_by;
        new.decided_at := old.decided_at;
      end if;
    else
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
  end if;
  return new;
end;
$function$;
