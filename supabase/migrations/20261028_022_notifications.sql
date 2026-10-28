-- In-app and phone (web push) notifications.
--  * notifications: one row per person per event (new entry waiting for approval, your entry approved / rejected / deleted ...)
--  * push_subscriptions: the phones / browsers that allowed notifications
--  * every new notification row calls the send-push edge function (pg_net); a failure there never blocks the entry itself
--  * private.push_config holds the push keys and the shared secret (values are inserted by hand, never kept in git)

create extension if not exists pg_net with schema extensions;

create table private.push_config (key text primary key, value text not null);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  entry_id uuid,
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

-- the edge function reads the keys and the phones with the service role only
create or replace function public.push_config()
returns jsonb language sql stable security definer set search_path to '' as $f$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from private.push_config;
$f$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

create or replace function private.push_notification()
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
create trigger notifications_push after insert on public.notifications for each row execute function private.push_notification();

create or replace function private.notify_entry_change()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare
  actor uuid := (select auth.uid());
  who text;
  proj text;
  txt text;
  link text := '#/search?q=' || new.seq;
begin
  select full_name into who from public.profiles where id = actor;
  select name into proj from public.projects where id = new.project_id;
  txt := 'قيد #' || new.seq || ' · ' || coalesce(proj, '') || ' · ' || new.category || coalesce(' · ' || new.item, '') || ' · ' || new.amount::text || ' ج.م';

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      select p.id, 'pending', 'قيد جديد مستنّي موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals', new.id
      from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'pending' then
    -- an entry that was approved / rejected went back to waiting (edited by its creator)
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    select p.id, 'pending', 'قيد اتعدّل ومستنّي موافقتك' || coalesce(' من ' || who, ''), txt, '#/approvals', new.id
    from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor;
  elsif new.status in ('approved', 'rejected') and new.created_by is distinct from actor and new.created_by is not null then
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    values (new.created_by, new.status, case when new.status = 'approved' then 'اتوافق على قيدك' else 'اترفض قيدك' end, txt, link, new.id);
  elsif new.status = 'deleted' then
    if new.created_by is not null and new.created_by is distinct from actor then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      values (new.created_by, 'deleted', 'قيدك اتمسح' || coalesce(' بواسطة ' || who, ''), txt, '#/projects/' || new.project_id, new.id);
    end if;
    if new.status_before_delete = 'approved' then
      insert into public.notifications (user_id, kind, title, body, url, entry_id)
      select p.id, 'deleted', 'اتمسح قيد معتمد' || coalesce(' بواسطة ' || who, ''), txt, '#/approvals', new.id
      from public.profiles p where p.role = 'admin' and p.is_active and p.id is distinct from actor and p.id is distinct from new.created_by;
    end if;
  elsif old.status = 'deleted' and new.created_by is not null and new.created_by is distinct from actor then
    insert into public.notifications (user_id, kind, title, body, url, entry_id)
    values (new.created_by, 'restored', 'قيدك اتسترجع', txt, link, new.id);
  end if;
  return new;
exception when others then
  return new; -- a notification problem must never stop an entry from being saved
end;
$f$;
create trigger entries_notify after insert or update on public.entries for each row execute function private.notify_entry_change();
