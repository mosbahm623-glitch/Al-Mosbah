-- رابط مشاركة المشروع مع العميل: صفحة للقراءة فقط من غير تسجيل دخول، والأدمن يلغي الرابط وقت ما يحب.
-- العميل بيشوف إجماليات المشروع والبنود وقائمة القيود (التاريخ والنوع والبند والبيان والمبلغ) بس.
-- المقاول والبنك واسم اللي سجّل والملاحظات مش بتخرج من قاعدة البيانات أصلاً (مش بتتخفي في الواجهة).
-- الدالة الوحيدة اللي بتتنادى من غير دخول بترجّع أعمدة محددة من القيود المعتمدة (المعلّق والمحذوف بره)،
-- ومفيش وصول مباشر لأي جدول لغير الأدمن.

create table public.project_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- رمز طويل عشوائي (حوالي 240 بت) مينفعش يتخمّن
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index project_shares_project_id_idx on public.project_shares (project_id);
create index project_shares_created_by_idx on public.project_shares (created_by);

alter table public.project_shares enable row level security;

create policy project_shares_select_admin on public.project_shares
  for select to authenticated using ((select private.is_admin()));
create policy project_shares_insert_admin on public.project_shares
  for insert to authenticated with check ((select private.is_admin()));
create policy project_shares_update_admin on public.project_shares
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.project_shares from anon, public;
grant select, insert, update on public.project_shares to authenticated;

-- الصفحة العامة: بترجّع null لو الرابط غلط أو اتلغى أو انتهى، وإلا إجماليات المشروع وبنوده وقيوده المعتمدة.
create or replace function public.shared_project(p_token text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  with s as (
    select project_id from public.project_shares
    where token = p_token
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ),
  p as (
    select pr.id, pr.name, pr.status from public.projects pr join s on s.project_id = pr.id
  ),
  e as (
    select ce.seq, ce.entry_date, ce.kind, ce.category, ce.item, ce.amount
    from private.counted_entries ce join s on s.project_id = ce.project_id
  )
  select jsonb_build_object(
    'name', p.name,
    'status', p.status,
    'income',   coalesce((select sum(amount) from e where kind = 'income'), 0),
    'expenses', coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', c.category, 'total', c.total) order by c.total desc)
      from (select category, sum(amount) as total from e where kind = 'expense' group by category) c
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', e.seq, 'entry_date', e.entry_date, 'kind', e.kind,
        'category', e.category, 'item', e.item, 'amount', e.amount
      ) order by e.seq desc)
      from e
    ), '[]'::jsonb)
  )
  from p;
$$;

revoke execute on function public.shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;

-- «مسح البيانات» بيمسح المشاريع، والروابط مربوطة بيها فلازم تتمسح معاها (باقي الدالة زي migration 064 بالظبط).
create or replace function public.reset_data(p_groups text[] default array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories'])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g text[] := coalesce(p_groups, '{}');
  me uuid := (select auth.uid());
  t text[] := '{}';
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if cardinality(g) = 0
     or not (g <@ array['entries', 'contractor_dues', 'projects', 'contractors', 'advances', 'banks', 'categories', 'users']) then
    raise exception 'unknown or empty selection' using errcode = '22023';
  end if;

  if (g && array['projects', 'contractors']) and not (g @> array['entries', 'contractor_dues']) then
    raise exception 'projects and contractors need entries and contractor_dues' using errcode = '22023';
  end if;
  if (g && array['advances', 'banks']) and not (g @> array['entries']) then
    raise exception 'advances and banks need entries' using errcode = '22023';
  end if;
  if 'users' = any (g) and not (g @> array['entries', 'contractor_dues', 'advances']) then
    raise exception 'users need entries, contractor_dues and advances' using errcode = '22023';
  end if;

  if 'entries' = any (g) then
    t := t || array['public.entry_attachments', 'public.entry_history', 'public.entries', 'public.entry_counters', 'public.bank_transfers'];
  end if;
  if 'contractor_dues' = any (g) then
    t := t || array['public.contractor_transactions', 'public.contractor_settlements'];
  end if;
  if 'projects' = any (g) then
    t := t || array['private.project_low_balance', 'public.project_shares', 'public.projects'];
  end if;
  if 'contractors' = any (g) then
    t := t || array['public.contractors'];
  end if;
  if 'advances' = any (g) then
    t := t || array['public.advance_installments', 'public.pending_advance_installments', 'public.advance_returns',
                    'public.user_advance_access', 'public.advances'];
  end if;
  if 'banks' = any (g) then
    t := t || array['public.user_bank_access', 'public.bank_accounts'];
  end if;
  if 'categories' = any (g) then
    t := t || array['public.expense_items', 'public.expense_categories'];
  end if;
  if cardinality(t) > 0 then
    execute 'truncate table ' || array_to_string(t, ', ') || ' restart identity';
  end if;

  if 'users' = any (g) then
    delete from public.backup_log where "by" is distinct from me;
    delete from private.allowed_emails where email in (select lower(u.email) from auth.users u where u.id <> me);
    delete from auth.users where id <> me;
  end if;

  update public.data_pings set at = now() where id = 1;
end;
$$;
revoke execute on function public.reset_data(text[]) from public, anon;
grant execute on function public.reset_data(text[]) to authenticated;
