-- Integration test for the live schema. Run it in the Supabase SQL editor (or via MCP execute_sql).
-- It creates temporary users/projects, checks permissions and totals, then ALWAYS rolls back by
-- raising an exception whose message holds the results. Nothing is left in the database.
--
-- Expected: user_insert=blocked, user_update_rows=0, user_delete_rows=0, user_cat_insert=blocked,
-- inactive_sees_projects/entries=0, anon_projects=0, summary.income=1500, summary.expenses=500
-- (400 expense + 100 custody installment; the 50 expense paid from the custody is not counted),
-- dash_net_formula_ok=true, items_after_cat_delete=0, zero_amount=blocked, seq_unique=true.
do $$
declare
  admin_id uuid; user_id uuid := gen_random_uuid(); off_id uuid := gen_random_uuid();
  pid uuid; aid uuid; cid uuid; res jsonb := '{}'::jsonb; n int; s jsonb; d jsonb; ok boolean;
begin
  select id into admin_id from public.profiles where role = 'admin' limit 1;
  insert into private.allowed_emails(email) values ('t-active@test.local'), ('t-off@test.local');
  insert into auth.users(id, email, aud, role) values
    (user_id, 't-active@test.local', 'authenticated', 'authenticated'),
    (off_id, 't-off@test.local', 'authenticated', 'authenticated');
  update public.profiles set is_active = true where id = user_id;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  insert into public.projects(name, budget, type) values ('__T', 1000, 'finishing') returning id into pid;
  insert into public.entries(project_id, kind, category, item, amount) values
    (pid, 'income', 'دفعة', 'x', 1500), (pid, 'expense', 'كهربا', 'أسلاك', 400);
  insert into public.advances(project_id, holder_name) values (pid, 'eng') returning id into aid;
  insert into public.advance_installments(advance_id, amount) values (aid, 100);
  insert into public.entries(project_id, kind, category, amount, advance_id) values (pid, 'expense', 'نثريات', 50, aid);
  insert into public.contractors(name) values ('__C') returning id into cid;
  insert into public.contractor_transactions(contractor_id, project_id, kind, amount)
    values (cid, pid, 'due', 300), (cid, pid, 'payment', 100);
  select x into s from jsonb_array_elements(public.project_summaries()) x where x->>'id' = pid::text;
  res := res || jsonb_build_object('summary', s);

  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  begin insert into public.entries(project_id, kind, category, amount) values (pid, 'income', 'x', 1);
    res := res || jsonb_build_object('user_insert', 'ALLOWED (BAD)');
  exception when others then res := res || jsonb_build_object('user_insert', 'blocked'); end;
  update public.projects set budget = 1 where id = pid; get diagnostics n = row_count;
  res := res || jsonb_build_object('user_update_rows', n);
  delete from public.entries where project_id = pid; get diagnostics n = row_count;
  res := res || jsonb_build_object('user_delete_rows', n);
  begin insert into public.expense_categories(name) values ('__bad');
    res := res || jsonb_build_object('user_cat_insert', 'ALLOWED (BAD)');
  exception when others then res := res || jsonb_build_object('user_cat_insert', 'blocked'); end;

  perform set_config('request.jwt.claims', json_build_object('sub', off_id, 'role', 'authenticated')::text, true);
  select count(*) into n from public.projects; res := res || jsonb_build_object('inactive_sees_projects', n);
  select count(*) into n from public.entries; res := res || jsonb_build_object('inactive_sees_entries', n);

  perform set_config('role', 'anon', true);
  select count(*) into n from public.projects; res := res || jsonb_build_object('anon_projects', n);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  d := public.dashboard_summary();
  res := res || jsonb_build_object('dash_net_formula_ok',
    (d->>'net_cash')::numeric = (d->>'total_income')::numeric - (d->>'total_expenses')::numeric
      - (d->>'total_advances')::numeric + (d->>'contractor_dues')::numeric);
  insert into public.expense_categories(name) values ('__cat') returning id into cid;
  insert into public.expense_items(category_id, name) values (cid, 'i1'), (cid, 'i2');
  delete from public.expense_categories where id = cid;
  select count(*) into n from public.expense_items where category_id = cid;
  res := res || jsonb_build_object('items_after_cat_delete', n);
  begin insert into public.entries(project_id, kind, category, amount) values (pid, 'income', 'x', 0);
    res := res || jsonb_build_object('zero_amount', 'ALLOWED (BAD)');
  exception when check_violation then res := res || jsonb_build_object('zero_amount', 'blocked'); end;
  select count(distinct seq) = count(*) into ok from public.entries where project_id = pid;
  res := res || jsonb_build_object('seq_unique', ok);

  perform set_config('role', 'postgres', true);
  raise exception 'RESULT %', res::text;
end $$;
