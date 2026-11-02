-- Invoice photos on entries: a private storage bucket + a table that links each file to its entry.
create table public.entry_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  path text not null unique,
  file_name text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index entry_attachments_entry_idx on public.entry_attachments (entry_id);
alter table public.entry_attachments enable row level security;
grant select, insert, delete on public.entry_attachments to authenticated;

-- seen by whoever can see the entry (row security of entries applies inside the check)
create policy entry_attachments_select on public.entry_attachments for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
-- added by staff, or by the person who recorded the entry
create policy entry_attachments_insert on public.entry_attachments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((select private.is_staff())
         or exists (select 1 from public.entries e where e.id = entry_id and e.created_by = (select auth.uid())))
  );
-- removed by staff, or by the person who recorded it while the entry is not yet approved
create policy entry_attachments_delete on public.entry_attachments for delete to authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.entries e
               where e.id = entry_id and e.created_by = (select auth.uid()) and e.status <> 'approved')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy invoices_read on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and exists (select 1 from public.entry_attachments a where a.path = name));
create policy invoices_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and ((select private.is_staff())
         or exists (select 1 from public.entries e
                    where e.id::text = (storage.foldername(name))[1] and e.created_by = (select auth.uid())))
  );
create policy invoices_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'invoices'
    and ((select private.is_staff())
         or exists (select 1 from public.entries e
                    where e.id::text = (storage.foldername(name))[1] and e.created_by = (select auth.uid()) and e.status <> 'approved'))
  );
