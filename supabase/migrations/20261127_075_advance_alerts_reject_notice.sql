-- 1) تنبيه رصيد العهدة: الأدمن يحدّد مين يوصله (أدمن / صاحب العهدة / المالك) وحد لكل عهدة.
--    مفيش عهدة بتنبّه إلا لما الأدمن يفعّلها. التنبيه مرة عند النزول تحت الحد ومرة عند النزول بالسالب،
--    ويتفعّل تاني لما الرصيد يرجع. الرصيد = الدفعات المعتمدة − المصروف المعتمد − المرتجع.
-- 2) إشعار الرفض: صاحب القيد أو دفعة العهدة يوصله إشعار بالرفض وسببه.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('low_balance', 'test', 'pending_entry', 'advance_low', 'rejected'));

-- صف واحد: مين يوصله تنبيه العهد
create table private.advance_alert_recipients (
  id boolean primary key default true check (id),
  to_admin boolean not null default true,
  to_holder boolean not null default true,
  to_owner boolean not null default true
);
alter table private.advance_alert_recipients enable row level security;
insert into private.advance_alert_recipients default values;

-- حد كل عهدة. level: 0 فوق الحد، 1 تحت الحد، 2 بالسالب (علشان التنبيه ما يتكررش مع كل قيد)
create table private.advance_alerts (
  advance_id uuid primary key references public.advances (id) on delete cascade,
  enabled boolean not null default false,
  threshold numeric(14, 2) not null default 0 check (threshold >= 0),
  level smallint not null default 0 check (level between 0 and 2)
);
alter table private.advance_alerts enable row level security;

create function private.advance_balance(p_advance uuid)
returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce((select sum(i.amount) from private.counted_installments i where i.advance_id = p_advance), 0)
       - private.advance_spent(p_advance)
       - coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = p_advance), 0)
$$;

create function private.advance_level(p_balance numeric, p_threshold numeric)
returns smallint language sql immutable set search_path to '' as $$
  select (case when p_balance < 0 then 2 when p_balance < p_threshold then 1 else 0 end)::smallint
$$;

create function private.refresh_advance_alert(p_advance uuid)
returns void language plpgsql security definer set search_path to '' as $f$
declare
  a record;
  cfg record;
  bal numeric;
  now_level smallint;
begin
  if p_advance is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('advance_alert:' || p_advance::text, 0));
  select * into cfg from private.advance_alerts where advance_id = p_advance and enabled;
  if not found then return; end if;
  select id, holder_name, status into a from public.advances where id = p_advance;
  if not found then return; end if;

  bal := private.advance_balance(p_advance);
  now_level := private.advance_level(bal, cfg.threshold);
  if now_level = cfg.level then return; end if;
  update private.advance_alerts set level = now_level where advance_id = p_advance;

  if now_level > cfg.level and a.status = 'open' then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'advance_low',
           case when now_level = 2 then 'رصيد العهدة بالسالب'
                else 'رصيد العهدة أقل من ' || to_char(cfg.threshold, 'FM999,999,999,990') || ' ج.م' end,
           a.holder_name || ' · الرصيد الحالي ' || to_char(round(bal), 'FM999,999,999,990') || ' ج.م',
           '#/advances/' || a.id
    from public.profiles p cross join private.advance_alert_recipients r
    where p.is_active
      and ((r.to_admin and p.role = 'admin')
        or (r.to_owner and p.role = 'owner')
        or (r.to_holder and p.role = 'user' and exists (
              select 1 from public.user_advance_access x where x.user_id = p.id and x.advance_id = a.id)));
  end if;
end;
$f$;

-- مشترك للقيود والدفعات والمرتجعات
create function private.advance_alert_changed()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  begin
    if tg_op <> 'INSERT' then
      perform private.refresh_advance_alert(old.advance_id);
    end if;
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.advance_id is distinct from old.advance_id) then
      perform private.refresh_advance_alert(new.advance_id);
    end if;
  exception when others then
    null; -- مشكلة في التنبيه ما توقفش حفظ الحركة أبدًا
  end;
  return null;
end;
$f$;

create trigger entries_advance_alert
  after insert or delete or update of status, amount, kind, advance_id on public.entries
  for each row execute function private.advance_alert_changed();
create trigger installments_advance_alert
  after insert or delete or update of status, amount, advance_id on public.advance_installments
  for each row execute function private.advance_alert_changed();
create trigger returns_advance_alert
  after insert or delete or update of amount, advance_id on public.advance_returns
  for each row execute function private.advance_alert_changed();

create function public.advance_alert_settings()
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'to_admin', r.to_admin, 'to_holder', r.to_holder, 'to_owner', r.to_owner,
      'advances', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', a.id, 'holder_name', a.holder_name, 'balance', private.advance_balance(a.id),
                 'enabled', coalesce(s.enabled, false), 'threshold', s.threshold) order by a.holder_name)
        from public.advances a left join private.advance_alerts s on s.advance_id = a.id
        where a.status = 'open'), '[]'::jsonb))
    from private.advance_alert_recipients r
  );
end;
$f$;
revoke execute on function public.advance_alert_settings() from public, anon;
grant execute on function public.advance_alert_settings() to authenticated;

-- p_rows: [{"id": uuid, "enabled": bool, "threshold": number}]
-- الحفظ ما بيبعتش إشعار: اللي تحت الحد دلوقتي بينبّه عند النزول الجاي (أو لما ينزل بالسالب).
create function public.save_advance_alert_settings(p_admin boolean, p_holder boolean, p_owner boolean, p_rows jsonb)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_admin is null or p_holder is null or p_owner is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid settings' using errcode = '22023';
  end if;
  if not (p_admin or p_holder or p_owner)
     and exists (select 1 from jsonb_to_recordset(p_rows) as x (enabled boolean) where x.enabled) then
    raise exception 'choose who receives the alert' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as x (enabled boolean, threshold numeric)
             where x.enabled is null or (x.enabled and x.threshold is null) or x.threshold < 0) then
    raise exception 'invalid threshold' using errcode = '22023';
  end if;

  update private.advance_alert_recipients set to_admin = p_admin, to_holder = p_holder, to_owner = p_owner where id;

  insert into private.advance_alerts as s (advance_id, enabled, threshold, level)
  select x.id, x.enabled, coalesce(x.threshold, 0),
         private.advance_level(private.advance_balance(x.id), coalesce(x.threshold, 0))
  from jsonb_to_recordset(p_rows) as x (id uuid, enabled boolean, threshold numeric)
  on conflict (advance_id) do update
    set enabled = excluded.enabled,
        threshold = excluded.threshold,
        -- من غير تغيير في الإعداد، حالة التنبيه تفضل زي ما هي
        level = case when (s.enabled, s.threshold) is distinct from (excluded.enabled, excluded.threshold)
                     then excluded.level else s.level end;
end;
$f$;
revoke execute on function public.save_advance_alert_settings(boolean, boolean, boolean, jsonb) from public, anon;
grant execute on function public.save_advance_alert_settings(boolean, boolean, boolean, jsonb) to authenticated;

-- ───────── إشعار الرفض ─────────
create function private.notify_rejected()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare
  what text;
  place text;
  link text;
  j jsonb := to_jsonb(new);
begin
  begin
    if new.status is distinct from 'rejected' or old.status is not distinct from 'rejected' then return new; end if;
    if new.created_by is null or new.created_by is not distinct from (select auth.uid()) then return new; end if;

    if tg_table_name = 'entries' then
      what := case when j ->> 'kind' = 'income' then 'وارد'
                   when (j ->> 'amount')::numeric < 0 then 'مرتجع' else 'مصروف' end;
      select '«' || name || '»' into place from public.projects where id = (j ->> 'project_id')::uuid;
      link := case when j ->> 'advance_id' is not null then '#/advances/' || (j ->> 'advance_id')
                   else '#/projects/' || (j ->> 'project_id') end;
    else
      what := 'دفعة عهدة';
      select holder_name into place from public.advances where id = new.advance_id;
      link := '#/advances/' || new.advance_id;
    end if;

    insert into public.notifications (user_id, kind, title, body, url)
    values (new.created_by, 'rejected',
            case when tg_table_name = 'entries' then 'قيدك اترفض' else 'دفعة العهدة اترفضت' end,
            what || ' ' || to_char(abs((j ->> 'amount')::numeric), 'FM999,999,999,990.##') || ' ج.م · ' || coalesce(place, '—')
              || E'\nالسبب: ' || coalesce(new.reject_reason, '—'),
            link);
  exception when others then
    null; -- مشكلة في الإشعار ما توقفش الرفض
  end;
  return new;
end;
$f$;

create trigger entries_notify_rejected after update of status on public.entries
  for each row execute function private.notify_rejected();
create trigger installments_notify_rejected after update of status on public.advance_installments
  for each row execute function private.notify_rejected();

revoke all on function private.advance_balance(uuid), private.advance_level(numeric, numeric),
  private.refresh_advance_alert(uuid), private.advance_alert_changed(), private.notify_rejected()
  from public, anon, authenticated;
