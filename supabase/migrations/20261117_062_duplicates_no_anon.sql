-- The duplicate-entries report is for signed-in admins only: signed-out visitors must not be able to call it.
revoke execute on function public.duplicate_entry_groups() from anon, public;
