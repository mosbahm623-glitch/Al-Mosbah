-- توحيد أسماء المقاولين: لو مقاول واحد مسجّل بأكتر من اسم، الأدمن يختار الاسم اللي هيفضل،
-- وكل قيود المقاولين الباقيين (المصروفات والمستحقات والدفعات والتسويات) بتتنقل له، وبعدها الأسماء التانية بتتشال.
-- للأدمن بس. مفيش بيان ولا مبلغ بيتغيّر: بس المقاول المربوط بالقيد. كل قيد اتنقل بيسجّل في تاريخه سبب «دمج مقاولين».
-- القيد المعتمد يفضل معتمد (الأدمن هو اللي بيعدّل)، ومفيش إشعارات بتتبعت.
create or replace function public.merge_contractors(p_keep uuid, p_drop uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  keep_name text;
  drop_names text;
  n_entries integer;
  n_txns integer;
  n_settlements integer;
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  p_drop := array(select distinct x from unnest(p_drop) as x where x is not null and x <> p_keep);
  if p_keep is null or coalesce(array_length(p_drop, 1), 0) = 0 then
    raise exception 'choose the contractor to keep and at least one to merge into it' using errcode = '22023';
  end if;
  select name into keep_name from public.contractors where id = p_keep;
  if keep_name is null then
    raise exception 'contractor to keep not found' using errcode = '22023';
  end if;
  if (select count(*) from public.contractors where id = any (p_drop)) <> array_length(p_drop, 1) then
    raise exception 'one of the contractors to merge was not found' using errcode = '22023';
  end if;
  select string_agg(name, '، ' order by name) into drop_names from public.contractors where id = any (p_drop);

  -- كل تعديل على قيد لازم له سبب؛ ده اللي بيظهر في تاريخ القيد
  perform set_config('app.edit_reason', 'دمج مقاولين: ' || drop_names || ' ← ' || keep_name, true);
  update public.entries set contractor_id = p_keep where contractor_id = any (p_drop);
  get diagnostics n_entries = row_count;
  update public.contractor_transactions set contractor_id = p_keep where contractor_id = any (p_drop);
  get diagnostics n_txns = row_count;
  update public.contractor_settlements set contractor_id = p_keep, contractor_name = keep_name where contractor_id = any (p_drop);
  get diagnostics n_settlements = row_count;
  delete from public.contractors where id = any (p_drop);

  return jsonb_build_object('entries', n_entries, 'transactions', n_txns, 'settlements', n_settlements);
end;
$function$;

revoke execute on function public.merge_contractors(uuid, uuid[]) from public, anon;
grant execute on function public.merge_contractors(uuid, uuid[]) to authenticated;
