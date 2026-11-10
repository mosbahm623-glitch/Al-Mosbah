-- الإشعارات من جديد. فيه نوعين بس:
--  * low_balance: لما رصيد مشروع نشط ينزل تحت 50,000 (مرة عند النزول، ويتفعّل تاني لما يرجع للحد أو فوقه) → للمالك
--  * test: إشعار تجريبي بيبعته الأدمن لكل الناس أو لأفراد معينين، يتأكد إن الإشعارات بتوصل
-- كل صف في notifications بيوصل لحظيًا في التطبيق (realtime) وعلى التليفون (web push عن طريق دالة send-push).
-- مفاتيح الإرسال بتتحط في private.push_config بإيد (مش في git).

create table private.push_config (key text primary key, value text not null);
alter table private.push_config enable row level security;

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('low_balance', 'test')),
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.notifications;

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- دالة send-push بتقرا المفاتيح والأجهزة بصلاحية service_role بس
create function public.push_config()
returns jsonb language sql stable security definer set search_path to '' as $f$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from private.push_config;
$f$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

-- أي إشعار جديد بيتبعت للتليفون فورًا؛ لو الإرسال فشل ما بيوقفش حفظ الإشعار
create function private.push_notification()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare cfg_url text; cfg_secret text;
begin
  select value into cfg_url from private.push_config where key = 'function_url';
  select value into cfg_secret from private.push_config where key = 'secret';
  if cfg_url is null or cfg_secret is null then return new; end if;
  begin
    perform net.http_post(
      url := cfg_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg_secret),
      body := jsonb_build_object('user_id', new.user_id, 'title', new.title, 'body', new.body, 'url', coalesce(new.url, '#/'))
    );
  exception when others then null;
  end;
  return new;
end;
$f$;
revoke all on function private.push_notification() from public, anon, authenticated;
create trigger notifications_push after insert on public.notifications for each row execute function private.push_notification();

-- ───────── تنبيه الرصيد ─────────
create function private.low_balance_threshold() returns numeric
language sql immutable set search_path to '' as $$ select 50000::numeric $$;

-- الرصيد = الوارد المعتمد − المصروف المعتمد (نفس الرقم اللي بيظهر في صفحة المشاريع)
create function private.project_balance(p_project uuid) returns numeric
language sql stable security definer set search_path to '' as $$
  select coalesce(sum(case when kind = 'income' then amount else -amount end), 0)
  from public.entries where project_id = p_project and status = 'approved'
$$;

-- بيفتكر أنهي مشاريع تحت الحد دلوقتي، علشان التنبيه ما يتكررش مع كل قيد
create table private.project_low_balance (
  project_id uuid primary key references public.projects (id) on delete cascade,
  below boolean not null,
  changed_at timestamptz not null default now()
);
alter table private.project_low_balance enable row level security;

create function private.refresh_low_balance(p_project uuid)
returns void language plpgsql security definer set search_path to '' as $f$
declare
  proj record;
  bal numeric;
  was_below boolean;
  now_below boolean;
begin
  select id, name, status into proj from public.projects where id = p_project;
  if proj.id is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('low_balance:' || proj.id::text, 0));
  bal := private.project_balance(proj.id);
  now_below := bal < private.low_balance_threshold();
  select below into was_below from private.project_low_balance where project_id = proj.id;

  insert into private.project_low_balance (project_id, below) values (proj.id, now_below)
  on conflict (project_id) do update
    set below = excluded.below,
        changed_at = case when private.project_low_balance.below is distinct from excluded.below then now() else private.project_low_balance.changed_at end;

  if now_below and not coalesce(was_below, false) and proj.status = 'active' then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'low_balance',
           'رصيد مشروع أقل من ' || to_char(private.low_balance_threshold(), 'FM999,999,999') || ' ج.م',
           '«' || proj.name || '» · الرصيد الحالي ' || to_char(round(bal), 'FM999,999,999') || ' ج.م',
           '#/projects/' || proj.id
    from public.profiles p where p.is_active and p.role = 'owner';
  end if;
end;
$f$;
revoke all on function private.refresh_low_balance(uuid) from public, anon, authenticated;

create function private.entries_low_balance()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  begin
    if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
      perform private.refresh_low_balance(old.project_id);
    end if;
    perform private.refresh_low_balance(new.project_id);
  exception when others then
    null; -- مشكلة في التنبيه ما توقفش حفظ القيد أبدًا
  end;
  return new;
end;
$f$;
revoke all on function private.entries_low_balance() from public, anon, authenticated;
create trigger entries_low_balance after insert or update of status, amount, kind, project_id on public.entries
  for each row execute function private.entries_low_balance();
revoke all on function private.low_balance_threshold() from public, anon, authenticated;
revoke all on function private.project_balance(uuid) from public, anon, authenticated;

-- المشاريع اللي تحت الحد النهاردة ما تنبّهش دلوقتي؛ بتنبّه عند النزول الجاي
insert into private.project_low_balance (project_id, below)
select id, private.project_balance(id) < private.low_balance_threshold() from public.projects;

-- ───────── الإشعار التجريبي (أدمن بس) ─────────
-- p_users فاضي/null = كل الحسابات المفعّلة. بترجّع عدد اللي اتبعتلهم.
create function public.send_test_notification(p_users uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender text;
  v_count integer;
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select coalesce(nullif(btrim(full_name), ''), 'الأدمن') into v_sender from public.profiles where id = (select auth.uid());

  insert into public.notifications (user_id, kind, title, body, url)
  select p.id, 'test', 'إشعار تجريبي',
         'ده إشعار تجريبي من «' || coalesce(v_sender, 'الأدمن') || '» للتأكد إن الإشعارات بتوصلك. مفيش مطلوب منك حاجة.',
         '#/notifications'
  from public.profiles p
  where p.is_active and (p_users is null or cardinality(p_users) = 0 or p.id = any (p_users));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.send_test_notification(uuid[]) from public, anon;
grant execute on function public.send_test_notification(uuid[]) to authenticated;

-- عدد التليفونات/المتصفحات المسجّلة لكل حساب (الأدمن بس) — علشان يعرف مين هيوصله الإشعار على التليفون
create function public.push_devices()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(user_id, n) from (select user_id, count(*) as n from public.push_subscriptions group by user_id) s), '{}'::jsonb);
end;
$$;
revoke execute on function public.push_devices() from public, anon;
grant execute on function public.push_devices() to authenticated;
