-- البنود (categories) and the items spent under each بند; entries get an item name and an optional contractor.
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

alter table public.entries
  add column item text,
  add column contractor_id uuid references public.contractors (id);
create index entries_contractor_id_idx on public.entries (contractor_id);

alter table public.expense_categories enable row level security;
alter table public.expense_items enable row level security;

create policy expense_categories_select on public.expense_categories for select to authenticated using ((select private.is_active_user()));
create policy expense_categories_insert_admin on public.expense_categories for insert to authenticated with check ((select private.is_admin()));
create policy expense_categories_update_admin on public.expense_categories for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy expense_categories_delete_admin on public.expense_categories for delete to authenticated using ((select private.is_admin()));

create policy expense_items_select on public.expense_items for select to authenticated using ((select private.is_active_user()));
create policy expense_items_insert_admin on public.expense_items for insert to authenticated with check ((select private.is_admin()));
create policy expense_items_update_admin on public.expense_items for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy expense_items_delete_admin on public.expense_items for delete to authenticated using ((select private.is_admin()));

create index expense_items_category_id_idx on public.expense_items (category_id);

insert into public.expense_categories (name) values
  ('جبس بورد'), ('إشراف هندسي'), ('كهربا'), ('سباكة'), ('تكييفات'), ('تجهيزات'),
  ('تشوينات'), ('عمالة'), ('محارة'), ('نثريات'), ('نقاشة');
