-- Low-balance alert: when a project's balance (approved income - approved expenses) drops below 50,000
-- every active user who was ticked "يستلم تنبيه الرصيد" gets one notification (phone push goes out
-- through the existing notifications_push trigger). It fires once per crossing and re-arms when the
-- balance climbs back to the threshold or above. Changing the threshold or the formula = one function below.

alter table public.profiles add column notify_low_balance boolean not null default false;
update public.profiles set notify_low_balance = true where is_active and role in ('admin', 'owner');

create function private.low_balance_threshold() returns numeric
language sql immutable set search_path to '' as $$ select 50000::numeric $$;

-- the single definition of "الرصيد": approved income minus approved expenses
create function private.project_balance(p_project uuid) returns numeric
language sql stable security definer set search_path to '' as $$
  select coalesce(sum(case when kind = 'income' then amount else -amount end), 0)
  from public.entries where project_id = p_project and status = 'approved'
$$;

-- remembers which projects are currently below, so the alert is not repeated on every entry
create table private.project_low_balance (
  project_id uuid primary key references public.projects (id) on delete cascade,
  below boolean not null,
  changed_at timestamptz not null default now()
);
alter table private.project_low_balance enable row level security;

create function private.check_low_balance()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare
  proj record;
  bal numeric;
  was_below boolean;
  now_below boolean;
begin
  if new.status is distinct from 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    return new;
  end if;
  select id, name, status into proj from public.projects where id = new.project_id;
  if proj.id is null or proj.status <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('low_balance:' || proj.id::text, 0));
  bal := private.project_balance(proj.id);
  now_below := bal < private.low_balance_threshold();
  select below into was_below from private.project_low_balance where project_id = proj.id;

  insert into private.project_low_balance (project_id, below) values (proj.id, now_below)
  on conflict (project_id) do update
    set below = excluded.below, changed_at = case when private.project_low_balance.below is distinct from excluded.below then now() else private.project_low_balance.changed_at end;

  if now_below and not coalesce(was_below, false) then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'low_balance',
           'رصيد مشروع أقل من ' || to_char(private.low_balance_threshold(), 'FM999,999,999'),
           '«' || proj.name || '» · الرصيد ' || to_char(round(bal), 'FM999,999,999') || ' ج.م',
           '#/projects/' || proj.id
    from public.profiles p where p.is_active and p.notify_low_balance;
  end if;
  return new;
exception when others then
  return new; -- an alert problem must never block saving an entry
end;
$f$;
revoke all on function private.check_low_balance() from public, anon, authenticated;
revoke all on function private.project_balance(uuid) from public, anon, authenticated;
revoke all on function private.low_balance_threshold() from public, anon, authenticated;

create trigger entries_low_balance after insert or update on public.entries
  for each row execute function private.check_low_balance();

-- projects already below today do not alert now; they alert on their next crossing
insert into private.project_low_balance (project_id, below)
select id, private.project_balance(id) < private.low_balance_threshold() from public.projects where status = 'active';
