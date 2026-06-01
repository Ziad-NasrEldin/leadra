-- Route Unit edit saves through a guarded RPC so PostgREST does not need
-- broad direct table SELECT privileges on owner-sensitive unit columns.

create or replace function public.update_unit_details(target_unit_id bigint, unit_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
  unit_row public.units%rowtype;
begin
  if actor_role is null then
    raise exception 'You must be signed in to edit units.';
  end if;

  if jsonb_typeof(coalesce(unit_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'unit_payload must be an object' using errcode = '22023';
  end if;

  select * into unit_row
  from public.units
  where id = target_unit_id
  for update;

  if not found then
    raise exception 'Unit not found.';
  end if;

  if actor_role not in ('admin', 'sub_admin') and (unit_row.created_by <> auth.uid() or unit_row.archived) then
    raise exception 'Only Admin, Sub Admin, or the current Unit Uploader can edit this unit.';
  end if;

  update public.units
  set
    developer_id = case when unit_payload ? 'developer_id' then (unit_payload->>'developer_id')::uuid else developer_id end,
    project_id = case when unit_payload ? 'project_id' then (unit_payload->>'project_id')::uuid else project_id end,
    destination_id = case when unit_payload ? 'destination_id' then (unit_payload->>'destination_id')::uuid else destination_id end,
    unit_type = case when unit_payload ? 'unit_type' then unit_payload->>'unit_type' else unit_type end,
    floor = case when unit_payload ? 'floor' then unit_payload->>'floor' else floor end,
    bua = case when unit_payload ? 'bua' then (unit_payload->>'bua')::numeric else bua end,
    roof_garden_area = case when unit_payload ? 'roof_garden_area' then nullif(unit_payload->>'roof_garden_area', '')::numeric else roof_garden_area end,
    garden_area = case when unit_payload ? 'garden_area' then nullif(unit_payload->>'garden_area', '')::numeric else garden_area end,
    terrace_area = case when unit_payload ? 'terrace_area' then nullif(unit_payload->>'terrace_area', '')::numeric else terrace_area end,
    view_id = case when unit_payload ? 'view_id' then (unit_payload->>'view_id')::uuid else view_id end,
    bedrooms = case when unit_payload ? 'bedrooms' then (unit_payload->>'bedrooms')::integer else bedrooms end,
    bathrooms = case when unit_payload ? 'bathrooms' then (unit_payload->>'bathrooms')::integer else bathrooms end,
    elevator = case when unit_payload ? 'elevator' then coalesce((unit_payload->>'elevator')::boolean, false) else elevator end,
    land_area = case when unit_payload ? 'land_area' then nullif(unit_payload->>'land_area', '')::numeric else land_area end,
    furnished = case when unit_payload ? 'furnished' then coalesce((unit_payload->>'furnished')::boolean, false) else furnished end,
    finish = case when unit_payload ? 'finish' then unit_payload->>'finish' else finish end,
    delivery_month = case when unit_payload ? 'delivery_month' then nullif(unit_payload->>'delivery_month', '')::integer else delivery_month end,
    delivery_year = case when unit_payload ? 'delivery_year' then (unit_payload->>'delivery_year')::integer else delivery_year end,
    sales_notes = case when unit_payload ? 'sales_notes' then coalesce(unit_payload->>'sales_notes', '') else sales_notes end,
    original_owner_name = case when unit_payload ? 'original_owner_name' then unit_payload->>'original_owner_name' else original_owner_name end,
    country_code = case when unit_payload ? 'country_code' then unit_payload->>'country_code' else country_code end,
    original_owner_phone = case when unit_payload ? 'original_owner_phone' then unit_payload->>'original_owner_phone' else original_owner_phone end,
    payment_method = case when unit_payload ? 'payment_method' then (unit_payload->>'payment_method')::public.payment_method else payment_method end,
    total_amount = case when unit_payload ? 'total_amount' then (unit_payload->>'total_amount')::numeric else total_amount end,
    down_payment = case when unit_payload ? 'down_payment' then nullif(unit_payload->>'down_payment', '')::numeric else down_payment end,
    transfer_fees = case when unit_payload ? 'transfer_fees' then nullif(unit_payload->>'transfer_fees', '')::numeric else transfer_fees end,
    maintenance_paid = case when unit_payload ? 'maintenance_paid' then coalesce((unit_payload->>'maintenance_paid')::boolean, false) else maintenance_paid end,
    maintenance_cost = case when unit_payload ? 'maintenance_cost' then nullif(unit_payload->>'maintenance_cost', '')::numeric else maintenance_cost end,
    maintenance_due_date = case when unit_payload ? 'maintenance_due_date' then nullif(unit_payload->>'maintenance_due_date', '')::date else maintenance_due_date end,
    installment_type = case when unit_payload ? 'installment_type' then nullif(unit_payload->>'installment_type', '')::public.installment_type else installment_type end,
    installment_years = case when unit_payload ? 'installment_years' then nullif(unit_payload->>'installment_years', '')::integer else installment_years end,
    installment_start_month = case when unit_payload ? 'installment_start_month' then nullif(unit_payload->>'installment_start_month', '')::date else installment_start_month end,
    installment_end_month = case when unit_payload ? 'installment_end_month' then nullif(unit_payload->>'installment_end_month', '')::date else installment_end_month end,
    installment_due_day = case when unit_payload ? 'installment_due_day' then coalesce(nullif(unit_payload->>'installment_due_day', '')::integer, 1) else installment_due_day end,
    custom_installment_text = case when unit_payload ? 'custom_installment_text' then nullif(unit_payload->>'custom_installment_text', '') else custom_installment_text end,
    commission_percentage = case when unit_payload ? 'commission_percentage' then (unit_payload->>'commission_percentage')::numeric else commission_percentage end,
    updated_at = now()
  where id = target_unit_id;
end;
$$;

revoke execute on function public.update_unit_details(bigint, jsonb) from public;
revoke execute on function public.update_unit_details(bigint, jsonb) from anon;
grant execute on function public.update_unit_details(bigint, jsonb) to authenticated;

create or replace function public.enforce_unit_edit_permissions()
returns trigger
language plpgsql
as $$
declare
  actor_role public.user_role := public.current_role();
  can_edit_non_owner boolean;
  can_edit_owner boolean;
  can_edit_pricing boolean;
  can_edit_commission boolean;
  can_archive boolean;
  can_manage_special boolean;
  timetable_update boolean := coalesce(current_setting('leadra.payment_timetable_update', true), '') = 'on';
begin
  can_edit_non_owner :=
    actor_role in ('admin', 'sub_admin')
    or (old.created_by = auth.uid() and old.archived = false);
  can_edit_owner :=
    actor_role in ('admin', 'sub_admin')
    or (old.created_by = auth.uid() and old.archived = false);
  can_edit_pricing :=
    actor_role in ('admin', 'sub_admin')
    or (old.created_by = auth.uid() and old.archived = false);
  can_edit_commission :=
    actor_role in ('admin', 'sub_admin')
    or (old.created_by = auth.uid() and old.archived = false);
  can_archive := actor_role in ('admin', 'sub_admin');
  can_manage_special := actor_role in ('admin', 'sub_admin');

  if old.remaining_payment is distinct from new.remaining_payment and not timetable_update then
    raise exception 'Remaining Value can only change through the payment timetable.';
  end if;

  if not can_archive and old.archived is distinct from new.archived then
    raise exception 'Archive is not allowed for this role.';
  end if;

  if not can_manage_special and (
    old.is_special is distinct from new.is_special
    or old.special_marked_at is distinct from new.special_marked_at
    or old.special_marked_by is distinct from new.special_marked_by
  ) then
    raise exception 'Only admins can manage special units.';
  end if;

  if old.status is distinct from new.status and not can_edit_non_owner then
    raise exception 'Only Admin, Sub Admin, or the current Unit Uploader can change Unit Status.';
  end if;

  if not (actor_role in ('admin', 'sub_admin')) and (
    old.created_by is distinct from new.created_by
    or old.team_id is distinct from new.team_id
    or old.branch_id is distinct from new.branch_id
  ) then
    raise exception 'Only admins can change Unit Uploader, Team, or Branch context.';
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
    old.payment_method is distinct from new.payment_method
    or old.down_payment is distinct from new.down_payment
    or old.total_amount is distinct from new.total_amount
    or old.transfer_fees is distinct from new.transfer_fees
    or old.maintenance_paid is distinct from new.maintenance_paid
    or old.maintenance_cost is distinct from new.maintenance_cost
    or old.maintenance_due_date is distinct from new.maintenance_due_date
    or old.installment_type is distinct from new.installment_type
    or old.installment_years is distinct from new.installment_years
    or old.installment_start_month is distinct from new.installment_start_month
    or old.installment_end_month is distinct from new.installment_end_month
    or old.installment_due_day is distinct from new.installment_due_day
    or old.custom_installment_text is distinct from new.custom_installment_text
    or old.installment_amount is distinct from new.installment_amount
  ) then
    raise exception 'You do not have permission to edit Total Value.';
  end if;

  if not can_edit_commission and old.commission_percentage is distinct from new.commission_percentage then
    raise exception 'You do not have permission to edit commission.';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
