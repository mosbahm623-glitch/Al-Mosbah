-- تفصيل «المستحق» لبنود: كل مستحق ممكن يتفصل لأعمال (بيان + بند + مبلغ).
-- التفصيل للعلم بس: مجموع البنود هو مبلغ المستحق، ومش بيدخل في مصروف المشروع (المصروف بيتحسب من الدفعات/القيود).
create table public.contractor_due_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.contractor_transactions (id) on delete cascade,
  item text not null,
  category text,
  amount numeric(14, 2) not null check (amount > 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index contractor_due_items_transaction_idx on public.contractor_due_items (transaction_id);

alter table public.contractor_due_items enable row level security;
create policy contractor_due_items_select on public.contractor_due_items for select to authenticated
  using ((select private.can_view('contractors')));
create policy contractor_due_items_insert on public.contractor_due_items for insert to authenticated
  with check ((select private.can_edit('contractors')));
create policy contractor_due_items_update on public.contractor_due_items for update to authenticated
  using ((select private.can_edit('contractors'))) with check ((select private.can_edit('contractors')));
create policy contractor_due_items_delete on public.contractor_due_items for delete to authenticated
  using ((select private.can_edit('contractors')));
revoke all on public.contractor_due_items from anon;
