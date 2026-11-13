-- تسجيل في الريبو لتغييرات كانت متطبقة على القاعدة الحية من غير ملف migration
-- (import_support_negative_expenses_and_extra_fields + pending_advance_installments_table).
-- كل حاجة هنا idempotent: على القاعدة الحية مفيش أي تغيير، وعلى قاعدة جديدة بتطلع زي الحية بالظبط.

-- مصروف بالسالب (مرتجع/خصم) مع إبقاء الإيراد موجب فقط
alter table public.entries drop constraint if exists entries_amount_check;
alter table public.entries add constraint entries_amount_check
  check ((kind = 'expense' and amount <> 0) or (kind = 'income' and amount > 0));

-- حقول المشروع اللي كانت في التطبيق القديم
alter table public.projects
  add column if not exists start_date date,
  add column if not exists close_date date,
  add column if not exists client_phone text,
  add column if not exists client_phone2 text,
  add column if not exists contractor_phones jsonb not null default '{}'::jsonb;

-- حقول القيد اللي كانت في التطبيق القديم
alter table public.entries
  add column if not exists entry_type text,
  add column if not exists img_url text,
  add column if not exists payment_method text;

-- تسويات المقاولين
create table if not exists public.contractor_settlements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  contractor_id uuid references public.contractors(id),
  contractor_name text not null,
  total_paid numeric not null default 0,
  total_works numeric not null default 0,
  balance numeric not null default 0,
  works jsonb,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.contractor_settlements enable row level security;
drop policy if exists contractor_settlements_select on public.contractor_settlements;
drop policy if exists contractor_settlements_insert on public.contractor_settlements;
drop policy if exists contractor_settlements_update on public.contractor_settlements;
drop policy if exists contractor_settlements_delete on public.contractor_settlements;
create policy contractor_settlements_select on public.contractor_settlements for select to authenticated using ((select private.can_view('contractors'::text)));
create policy contractor_settlements_insert on public.contractor_settlements for insert to authenticated with check ((select private.can_edit('contractors'::text)));
create policy contractor_settlements_update on public.contractor_settlements for update to authenticated using ((select private.can_edit('contractors'::text))) with check ((select private.can_edit('contractors'::text)));
create policy contractor_settlements_delete on public.contractor_settlements for delete to authenticated using ((select private.can_edit('contractors'::text)));

-- دفعات العهد المعلّقة
create table if not exists public.pending_advance_installments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances(id),
  amount numeric not null check (amount > 0),
  paid_on date not null default current_date,
  payment_method text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.pending_advance_installments enable row level security;
drop policy if exists pending_adv_inst_select on public.pending_advance_installments;
drop policy if exists pending_adv_inst_insert on public.pending_advance_installments;
drop policy if exists pending_adv_inst_update on public.pending_advance_installments;
drop policy if exists pending_adv_inst_delete on public.pending_advance_installments;
create policy pending_adv_inst_select on public.pending_advance_installments for select to authenticated using ((select private.can_view('advances'::text)));
create policy pending_adv_inst_insert on public.pending_advance_installments for insert to authenticated with check ((select private.can_edit('advances'::text)));
create policy pending_adv_inst_update on public.pending_advance_installments for update to authenticated using ((select private.can_edit('advances'::text))) with check ((select private.can_edit('advances'::text)));
create policy pending_adv_inst_delete on public.pending_advance_installments for delete to authenticated using ((select private.can_edit('advances'::text)));
