-- توحيد أسماء البنود: لو بند واحد مسجّل بأكتر من اسم، الأدمن يختار الاسم اللي هيفضل،
-- وكل القيود وبنود المستحقات والتوزيعات اللي بالأسماء التانية بتتنقل له، والبيانات المحفوظة تحتهم بتتضم، وبعدها الأسماء التانية بتتشال.
-- للأدمن بس. مفيش مبلغ ولا بيان بيتغيّر: بس اسم البند. كل قيد اتنقل بيسجّل في تاريخه سبب «دمج بنود».
create or replace function public.merge_categories(p_keep uuid, p_drop uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  keep_name text;
  drop_names text[];
  names_txt text;
  n_entries integer;
  n_dues integer;
  n_dist integer;
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  p_drop := array(select distinct x from unnest(p_drop) as x where x is not null and x <> p_keep);
  if p_keep is null or coalesce(array_length(p_drop, 1), 0) = 0 then
    raise exception 'choose the category to keep and at least one to merge into it' using errcode = '22023';
  end if;
  select name into keep_name from public.expense_categories where id = p_keep;
  if keep_name is null then
    raise exception 'category to keep not found' using errcode = '22023';
  end if;
  if (select count(*) from public.expense_categories where id = any (p_drop)) <> array_length(p_drop, 1) then
    raise exception 'one of the categories to merge was not found' using errcode = '22023';
  end if;
  select array_agg(name order by name) into drop_names from public.expense_categories where id = any (p_drop);
  names_txt := array_to_string(drop_names, '، ');

  perform set_config('app.edit_reason', 'دمج بنود: ' || names_txt || ' ← ' || keep_name, true);
  update public.entries set category = keep_name where category = any (drop_names);
  get diagnostics n_entries = row_count;
  update public.contractor_due_items set category = keep_name where category = any (drop_names);
  get diagnostics n_dues = row_count;
  update public.payment_distribution_items set category = keep_name where category = any (drop_names);
  get diagnostics n_dist = row_count;

  -- البيانات المحفوظة: اللي مش موجودة تحت البند اللي هيفضل بتتنقل، والمكررة بتتشال مع البند
  update public.expense_items i set category_id = p_keep
   where i.category_id = any (p_drop)
     and not exists (select 1 from public.expense_items k where k.category_id = p_keep and k.name = i.name);
  delete from public.expense_categories where id = any (p_drop);

  return jsonb_build_object('entries', n_entries, 'dues', n_dues, 'distributions', n_dist);
end;
$function$;

revoke execute on function public.merge_categories(uuid, uuid[]) from public, anon;
grant execute on function public.merge_categories(uuid, uuid[]) to authenticated;
