create or replace function public.prevent_non_admin_unit_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.archived is false
    and new.archived is true
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and coalesce(public.current_role()::text, '') not in ('admin', 'sub_admin') then
    raise exception 'Only Admin and Sub Admin can archive units.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists units_prevent_non_admin_archive on public.units;
create trigger units_prevent_non_admin_archive
before update of archived on public.units
for each row execute function public.prevent_non_admin_unit_archive();
