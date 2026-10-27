-- Which bank / account an expense was paid from (optional; not used for custody expenses).
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.bank_accounts enable row level security;
create policy bank_accounts_select on public.bank_accounts for select to authenticated using ((select private.is_active_user()));
create policy bank_accounts_insert_admin on public.bank_accounts for insert to authenticated with check ((select private.is_admin()));
create policy bank_accounts_update_admin on public.bank_accounts for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy bank_accounts_delete_admin on public.bank_accounts for delete to authenticated using ((select private.is_admin()));

alter table public.entries add column bank_id uuid references public.bank_accounts (id);
create index entries_bank_id_idx on public.entries (bank_id);
