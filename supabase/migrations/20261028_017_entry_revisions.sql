-- Several people working on entries at once:
--  * seq is an identity column, so two simultaneous inserts can never get the same number; the unique index makes that a hard guarantee.
--  * rev counts the changes of an entry. The app only saves or approves an entry if rev is still the one it loaded,
--    so nobody silently overwrites someone else's edit (or approves an amount that was just changed).
alter table public.entries add column rev integer not null default 1;
create unique index entries_seq_key on public.entries (seq);

create or replace function private.entry_approval_flow()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.rev := 1;
    new.created_by := (select auth.uid());
    new.decided_by := null;
    new.decided_at := null;
    new.status := case when private.is_admin() or (select auth.uid()) is null then 'approved' else 'pending' end;
  else
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
