-- تذكير بيبعته الأدمن بإيده: إشعار لكل مالك مفعّل فيه كل المشاريع النشطة اللي رصيدها أقل من الحد (50 ألف).
-- ده إضافة على التنبيه التلقائي (entries_low_balance) مش بديل عنه. الأدمن بس.
-- بترجّع عدد المشاريع وعدد المالكين اللي اتبعتلهم.
create or replace function public.send_low_balance_reminder()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric := private.low_balance_threshold();
  v_projects integer;
  v_owners integer := 0;
  v_body text;
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  with low as (
    select p.name, private.project_balance(p.id) as bal
    from public.projects p
    where p.status = 'active' and private.project_balance(p.id) < v_limit
  ), ranked as (
    select name, bal, row_number() over (order by bal, name) as rn from low
  )
  select (select count(*) from low),
         nullif(
           string_agg('«' || name || '» ' || to_char(round(bal), 'FM999,999,999'), E'\n' order by rn) filter (where rn <= 12)
           || case when (select count(*) from low) > 12 then E'\nو ' || ((select count(*) from low) - 12) || ' مشروع تانيين' else '' end,
           '')
  into v_projects, v_body
  from ranked;

  if v_projects > 0 then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'low_balance',
           'تذكير: ' || v_projects || ' مشروع رصيدهم أقل من ' || to_char(v_limit, 'FM999,999,999'),
           v_body, '#/projects'
    from public.profiles p where p.is_active and p.role = 'owner';
    get diagnostics v_owners = row_count;
  end if;
  return jsonb_build_object('projects', v_projects, 'owners', v_owners);
end;
$$;
revoke execute on function public.send_low_balance_reminder() from public, anon;
grant execute on function public.send_low_balance_reminder() to authenticated;
