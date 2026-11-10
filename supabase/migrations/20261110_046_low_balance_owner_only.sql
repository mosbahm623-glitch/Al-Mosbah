-- التنبيه التلقائي لنزول رصيد مشروع تحت الحد بقى للمالك بس (كان بيوصل لأي حد معلّم عليه «يستلم تنبيه الرصيد»، منهم الأدمن).
create or replace function private.check_low_balance()
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
    from public.profiles p where p.is_active and p.role = 'owner' and p.notify_low_balance;
  end if;
  return new;
exception when others then
  return new; -- an alert problem must never block saving an entry
end;
$f$;
