create or replace function public.deactivate_sales_representative_after_reassignment(
  target_sales_user_id uuid,
  replacement_sales_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role;
  replacement_team_id uuid;
  replacement_branch_id uuid;
  changed_at_value timestamptz := now();
begin
  select role
  into actor_role
  from public.profiles
  where id = auth.uid()
    and status = 'active'
    and deleted_at is null;

  if actor_role not in ('admin', 'sub_admin') then
    raise exception 'Only Admin and Sub Admin can deactivate sales representatives.';
  end if;

  if target_sales_user_id = replacement_sales_user_id then
    raise exception 'Replacement sales representative must be different from the deactivated sales representative.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = target_sales_user_id
      and role = 'sales'
      and status in ('active', 'inactive')
      and deleted_at is null
  ) then
    raise exception 'Select a sales representative to deactivate.';
  end if;

  select team_id, branch_id
  into replacement_team_id, replacement_branch_id
  from public.profiles
  where id = replacement_sales_user_id
    and role = 'sales'
    and status = 'active'
    and deleted_at is null;

  if not found then
    raise exception 'Select an active replacement sales representative.';
  end if;

  insert into public.unit_sales_assignment_history (
    unit_id,
    previous_sales_user_id,
    new_sales_user_id,
    changed_by,
    changed_at,
    reason
  )
  select
    id,
    target_sales_user_id,
    replacement_sales_user_id,
    auth.uid(),
    changed_at_value,
    'sales_rep_deactivated_after_reassignment'
  from public.units
  where created_by = target_sales_user_id;

  update public.units
  set
    created_by = replacement_sales_user_id,
    team_id = replacement_team_id,
    branch_id = replacement_branch_id,
    updated_at = changed_at_value
  where created_by = target_sales_user_id;

  update public.profiles
  set
    status = 'inactive',
    deleted_at = changed_at_value
  where id = target_sales_user_id;
end;
$$;

grant execute on function public.deactivate_sales_representative_after_reassignment(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
