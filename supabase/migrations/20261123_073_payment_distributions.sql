-- توزيع دفعات المقاول على أعمال: المحاسب يختار دفعات (قيود مصروف باسم المقاول في مشروع) ويوزّعها على أعمال (بيان + بند + مبلغ).
-- القيود نفسها ما بتتغيّرش خالص (النقدية والبنوك والمشروع زي ما هم). التوزيع بس بيغيّر عرض تقارير البنود: بدل الدفعة بيظهر الشغل.
-- مجموع الأعمال لازم يكون أقل من أو يساوي مجموع الدفعات المتاحة؛ الباقي بيفضل «تحت الحساب» عند المقاول.
create table public.payment_distributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  contractor_id uuid not null references public.contractors (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index payment_distributions_contractor_idx on public.payment_distributions (contractor_id, project_id);

create table public.payment_distribution_items (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.payment_distributions (id) on delete cascade,
  item text not null,
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  position int not null default 0
);
create index payment_distribution_items_dist_idx on public.payment_distribution_items (distribution_id);

-- كل سطر = كام من قيد معيّن اتوزّع (القيد ممكن يتوزّع جزء منه)
create table public.payment_distribution_entries (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.payment_distributions (id) on delete cascade,
  entry_id uuid not null references public.entries (id),
  amount numeric(14, 2) not null check (amount > 0)
);
create index payment_distribution_entries_dist_idx on public.payment_distribution_entries (distribution_id);
create index payment_distribution_entries_entry_idx on public.payment_distribution_entries (entry_id);

do $$
declare t text;
begin
  foreach t in array array['payment_distributions', 'payment_distribution_items', 'payment_distribution_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.can_view(''contractors'')))', t || '_select', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
-- الكتابة بتعدّي على الدوال تحت بس (بتتحقق من الأرقام في معاملة واحدة)

create or replace function public.distribute_payments(
  p_project uuid,
  p_contractor uuid,
  p_entries uuid[],
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  dist_id uuid;
  available numeric(14, 2) := 0;
  wanted numeric(14, 2) := 0;
  left_to_use numeric(14, 2);
  used numeric(14, 2);
  e record;
  it jsonb;
  pos int := 0;
begin
  if not private.can_edit('contractors') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_entries, 1), 0) = 0 or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'choose payments and add at least one work item' using errcode = '22023';
  end if;

  -- المتاح من كل قيد = مبلغه − اللي اتوزّع منه قبل كده (القيود لازم تكون معتمدة، مصروف، لنفس المقاول والمشروع)
  if (
    select count(*) from public.entries en
    where en.id = any (p_entries) and en.kind = 'expense' and en.status = 'approved'
      and en.project_id = p_project and en.contractor_id = p_contractor
  ) <> (select count(distinct x) from unnest(p_entries) as x) then
    raise exception 'one of the payments is not an approved expense of this contractor in this project' using errcode = '22023';
  end if;
  select coalesce(sum(greatest(en.amount - coalesce(u.used, 0), 0)), 0) into available
  from public.entries en
  left join lateral (select sum(d.amount) as used from public.payment_distribution_entries d where d.entry_id = en.id) u on true
  where en.id = any (p_entries);

  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(it ->> 'item'), '') = '' or coalesce(trim(it ->> 'category'), '') = '' or coalesce((it ->> 'amount')::numeric, 0) <= 0 then
      raise exception 'each work item needs a description, a category and an amount' using errcode = '22023';
    end if;
    wanted := wanted + (it ->> 'amount')::numeric;
  end loop;
  if wanted > available then
    raise exception 'work total % is more than the payments available %', wanted, available using errcode = '22023';
  end if;

  insert into public.payment_distributions (project_id, contractor_id) values (p_project, p_contractor) returning id into dist_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.payment_distribution_items (distribution_id, item, category, amount, position)
    values (dist_id, trim(it ->> 'item'), trim(it ->> 'category'), (it ->> 'amount')::numeric, pos);
    pos := pos + 1;
  end loop;

  -- الأعمال بتاكل من الدفعات بالترتيب: الأقدم الأول
  left_to_use := wanted;
  for e in
    select en.id, en.amount - coalesce(u.used, 0) as free
    from public.entries en
    left join lateral (select sum(d.amount) as used from public.payment_distribution_entries d where d.entry_id = en.id) u on true
    where en.id = any (p_entries) and en.amount - coalesce(u.used, 0) > 0
    order by en.entry_date, en.seq
  loop
    exit when left_to_use <= 0;
    used := least(e.free, left_to_use);
    insert into public.payment_distribution_entries (distribution_id, entry_id, amount) values (dist_id, e.id, used);
    left_to_use := left_to_use - used;
  end loop;
  return dist_id;
end;
$function$;

create or replace function public.undo_payment_distribution(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not private.can_edit('contractors') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.payment_distributions where id = p_id;
end;
$function$;

-- الحذف من الجدول نفسه بيعدّي عن طريق الدالة بس، فالـ delete محتاج سياسة تسمح بيه للي يقدر يعدّل
create policy payment_distributions_delete on public.payment_distributions for delete to authenticated
  using ((select private.can_edit('contractors')));
create policy payment_distributions_insert on public.payment_distributions for insert to authenticated
  with check ((select private.can_edit('contractors')));
create policy payment_distribution_items_insert on public.payment_distribution_items for insert to authenticated
  with check ((select private.can_edit('contractors')));
create policy payment_distribution_entries_insert on public.payment_distribution_entries for insert to authenticated
  with check ((select private.can_edit('contractors')));

revoke execute on function public.distribute_payments(uuid, uuid, uuid[], jsonb) from public, anon;
grant execute on function public.distribute_payments(uuid, uuid, uuid[], jsonb) to authenticated;
revoke execute on function public.undo_payment_distribution(uuid) from public, anon;
grant execute on function public.undo_payment_distribution(uuid) to authenticated;
