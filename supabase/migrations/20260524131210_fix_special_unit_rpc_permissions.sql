create or replace function public.set_unit_special(target_unit_id bigint, mark_special boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
begin
  if coalesce(actor_role::text, '') not in ('admin', 'sub_admin') then
    raise exception 'Only admins can manage special units.';
  end if;

  update public.units
  set
    is_special = mark_special,
    special_marked_at = case when mark_special then now() else null end,
    special_marked_by = case when mark_special then auth.uid() else null end,
    updated_at = now()
  where id = target_unit_id;

  if not found then
    raise exception 'Unit not found.';
  end if;
end;
$$;

revoke all on function public.set_unit_special(bigint, boolean) from public;
grant execute on function public.set_unit_special(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
