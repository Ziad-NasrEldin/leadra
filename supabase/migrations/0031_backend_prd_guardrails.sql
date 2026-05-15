do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unit_media_image_only'
      and conrelid = 'public.unit_media'::regclass
  ) then
    alter table public.unit_media
      add constraint unit_media_image_only check (type = 'image') not valid;
  end if;
end;
$$;

create or replace function public.enforce_unit_edit_permissions()
returns trigger
language plpgsql
as $$
declare
  actor_role public.user_role := public.current_role();
  actor_team uuid := public.current_team_id();
  can_edit_non_owner boolean;
  can_edit_owner boolean;
  can_edit_pricing boolean;
  can_edit_commission boolean;
  can_archive boolean;
  timetable_update boolean := coalesce(current_setting('leadra.payment_timetable_update', true), '') = 'on';
begin
  if old.remaining_payment is distinct from new.remaining_payment and not timetable_update then
    raise exception 'Remaining Value can only change through the payment timetable.';
  end if;

  if old.payment_method is distinct from new.payment_method
    or old.down_payment is distinct from new.down_payment
    or old.installment_amount is distinct from new.installment_amount then
    raise exception 'Payment fields cannot be edited from unit edit mode.';
  end if;

  can_edit_non_owner :=
    actor_role in ('admin', 'sub_admin')
    or (actor_role = 'manager' and old.team_id = actor_team)
    or (actor_role = 'sales' and old.created_by = auth.uid() and old.archived = false);
  can_edit_owner := actor_role in ('admin', 'sub_admin');
  can_edit_pricing :=
    actor_role in ('admin', 'sub_admin')
    or (actor_role = 'sales' and old.created_by = auth.uid() and old.archived = false);
  can_edit_commission := actor_role in ('admin', 'sub_admin');
  can_archive := actor_role in ('admin', 'sub_admin');

  if not can_archive and old.archived is distinct from new.archived then
    raise exception 'Archive is not allowed for this role.';
  end if;

  if not can_edit_non_owner and (
    old.developer_id is distinct from new.developer_id
    or old.project_id is distinct from new.project_id
    or old.destination_id is distinct from new.destination_id
    or old.unit_type is distinct from new.unit_type
    or old.floor is distinct from new.floor
    or old.bua is distinct from new.bua
    or old.roof_garden_area is distinct from new.roof_garden_area
    or old.garden_area is distinct from new.garden_area
    or old.terrace_area is distinct from new.terrace_area
    or old.view_id is distinct from new.view_id
    or old.bedrooms is distinct from new.bedrooms
    or old.bathrooms is distinct from new.bathrooms
    or old.elevator is distinct from new.elevator
    or old.land_area is distinct from new.land_area
    or old.furnished is distinct from new.furnished
    or old.finish is distinct from new.finish
    or old.delivery_month is distinct from new.delivery_month
    or old.delivery_year is distinct from new.delivery_year
    or old.sales_notes is distinct from new.sales_notes
  ) then
    raise exception 'You do not have permission to edit these unit details.';
  end if;

  if not can_edit_owner and (
    old.original_owner_name is distinct from new.original_owner_name
    or old.country_code is distinct from new.country_code
    or old.original_owner_phone is distinct from new.original_owner_phone
    or old.normalized_owner_phone is distinct from new.normalized_owner_phone
  ) then
    raise exception 'You do not have permission to edit owner details.';
  end if;

  if not can_edit_pricing and (
    old.total_amount is distinct from new.total_amount
    or old.transfer_fees is distinct from new.transfer_fees
    or old.maintenance_paid is distinct from new.maintenance_paid
    or old.maintenance_cost is distinct from new.maintenance_cost
    or old.maintenance_due_date is distinct from new.maintenance_due_date
    or old.installment_type is distinct from new.installment_type
    or old.installment_years is distinct from new.installment_years
    or old.installment_start_month is distinct from new.installment_start_month
    or old.installment_end_month is distinct from new.installment_end_month
    or old.custom_installment_text is distinct from new.custom_installment_text
  ) then
    raise exception 'You do not have permission to edit Total Value.';
  end if;

  if not can_edit_commission and old.commission_percentage is distinct from new.commission_percentage then
    raise exception 'You do not have permission to edit commission.';
  end if;

  return new;
end;
$$;
