-- تذكير بيبعته الأدمن بإيده للمالك بالمشاريع النشطة اللي رصيدها أقل من 50,000 (إضافة على التنبيه التلقائي).
-- low_balance_overview: المعاينة قبل الإرسال. send_low_balance_reminder: الإرسال. الاتنين للأدمن بس.
create function public.low_balance_overview()
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
  return jsonb_build_object(
    'limit', private.low_balance_threshold(),
    'owners', (select count(*) from public.profiles where is_active and role = 'owner'),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'balance', bal) order by bal, name)
      from (select p.name, round(private.project_balance(p.id)) as bal
            from public.projects p
            where p.status = 'active' and private.project_balance(p.id) < private.low_balance_threshold()) low
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.low_balance_overview() from public, anon;
grant execute on function public.low_balance_overview() to authenticated;

create function public.send_low_balance_reminder()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric := private.low_balance_threshold();
  v_count integer;
  v_owners integer := 0;
  v_body text;
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select count(*),
         string_agg('«' || name || '» ' || to_char(bal, 'FM999,999,999'), E'\n' order by rn) filter (where rn <= 12)
         || case when count(*) > 12 then E'\nو ' || (count(*) - 12) || ' مشروع تانيين' else '' end
  into v_count, v_body
  from (
    select p.name, round(private.project_balance(p.id)) as bal,
           row_number() over (order by private.project_balance(p.id), p.name) as rn
    from public.projects p
    where p.status = 'active' and private.project_balance(p.id) < v_limit
  ) low;

  if v_count > 0 then
    insert into public.notifications (user_id, kind, title, body, url)
    select p.id, 'low_balance',
           'تذكير: ' || v_count || ' مشروع رصيدهم أقل من ' || to_char(v_limit, 'FM999,999,999') || ' ج.م',
           v_body, '#/projects'
    from public.profiles p where p.is_active and p.role = 'owner';
    get diagnostics v_owners = row_count;
  end if;
  return jsonb_build_object('projects', v_count, 'owners', v_owners);
end;
$$;
revoke execute on function public.send_low_balance_reminder() from public, anon;
grant execute on function public.send_low_balance_reminder() to authenticated;
