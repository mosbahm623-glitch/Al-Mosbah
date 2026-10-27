-- Everyone with access can read profile names, so every entry can show who recorded it.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_any_access()));
