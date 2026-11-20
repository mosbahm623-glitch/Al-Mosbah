-- رابط العميل: الأدمن يختار لكل رابط يظهّر رقم القيد والتاريخ ولا لأ (الافتراضي: مش بيظهروا).
alter table public.project_shares
  add column show_seq boolean not null default false,
  add column show_date boolean not null default false;

create or replace function public.shared_project(p_token text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  with s as (
    select project_id, show_seq, show_date from public.project_shares
    where token = p_token
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ),
  p as (
    select pr.id, pr.name, pr.status, s.show_seq, s.show_date
    from public.projects pr join s on s.project_id = pr.id
  ),
  e as (
    select ce.id, ce.seq, ce.entry_date, ce.kind, ce.category, ce.item, ce.amount
    from private.counted_entries ce join s on s.project_id = ce.project_id
  )
  select jsonb_build_object(
    'name', p.name,
    'status', p.status,
    'show_seq', p.show_seq,
    'show_date', p.show_date,
    'income',   coalesce((select sum(amount) from e where kind = 'income'), 0),
    'expenses', coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', c.category, 'total', c.total) order by c.total desc)
      from (select category, sum(amount) as total from e where kind = 'expense' group by category) c
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', e.seq, 'entry_date', e.entry_date, 'kind', e.kind,
        'category', e.category, 'item', e.item, 'amount', e.amount,
        'files', (select count(*)::int from public.entry_attachments a where a.entry_id = e.id)
      ) order by e.seq desc)
      from e
    ), '[]'::jsonb)
  )
  from p;
$$;

revoke execute on function public.shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;
