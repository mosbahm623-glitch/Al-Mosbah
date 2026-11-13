-- فهارس للمفاتيح الخارجية اللي لسه من غير فهرس (تنبيه Supabase performance advisor)
create index if not exists contractor_settlements_contractor_idx on public.contractor_settlements (contractor_id);
create index if not exists contractor_settlements_created_by_idx on public.contractor_settlements (created_by);
create index if not exists contractor_settlements_project_idx on public.contractor_settlements (project_id);
create index if not exists entry_attachments_created_by_idx on public.entry_attachments (created_by);
create index if not exists pending_advance_installments_advance_idx on public.pending_advance_installments (advance_id);
create index if not exists pending_advance_installments_submitted_by_idx on public.pending_advance_installments (submitted_by);
