-- مصروف العهدة لازم يتحسب كامل حتى لو فيه مشاريع مخفية عن المستخدم (حسب نوع المشاريع أو المشاريع المحددة له).
-- التفاصيل (قيود كل مشروع) تفضل ظاهرة للمسموح له بس؛ الإجمالي والرصيد بس هما اللي بيتحسبوا كامل.
create function private.advance_spent(p_advance uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)
  from public.entries e
  where e.advance_id = p_advance and e.kind = 'expense' and e.status = 'approved';
$$;
revoke execute on function private.advance_spent(uuid) from public, anon;
grant execute on function private.advance_spent(uuid) to authenticated;

create or replace function public.advance_summaries()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      a.id, a.holder_name, a.status, a.notes, a.created_at,
      coalesce((select sum(i.amount) from public.advance_installments i where i.advance_id = a.id and i.status = 'approved'), 0) as given,
      private.advance_spent(a.id) as spent,
      coalesce((select sum(x.amount) from public.advance_returns x where x.advance_id = a.id), 0) as returned
    from public.advances a
  ) r;
$$;
