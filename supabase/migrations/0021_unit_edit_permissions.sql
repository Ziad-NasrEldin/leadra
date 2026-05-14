create or replace function public.prepare_unit_calculations()
returns trigger
language plpgsql
as $$
declare
  destination_label text;
  payments_per_year integer;
begin
  new.normalized_owner_phone := public.normalize_owner_phone(new.original_owner_phone, new.country_code);

  if tg_op = 'INSERT' then
    new.remaining_payment := case when new.payment_method = 'installment' then new.total_amount - coalesce(new.down_payment, 0) else null end;
  else
    new.remaining_payment := old.remaining_payment;
  end if;

  if new.payment_method = 'cash' then
    new.down_payment := null;
    new.remaining_payment := null;
    new.installment_type := null;
    new.installment_years := null;
    new.installment_amount := null;
  elsif new.installment_type = 'custom' then
    new.installment_amount := null;
  else
    payments_per_year := case new.installment_type when 'quarterly' then 4 when 'semi_annual' then 2 when 'annual' then 1 else null end;
    new.installment_amount := round(new.remaining_payment / nullif((coalesce(new.installment_years, 0) * payments_per_year), 0), 2);
  end if;

  if new.unit_code is null then
    select label into destination_label from public.lookup_values where id = new.destination_id;
    new.unit_code := upper(left(regexp_replace(coalesce(destination_label, 'NA'), '[^A-Za-z]', '', 'g'), 2)) || new.id || 'BR' || new.bedrooms || 'Ba' || new.bathrooms;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.enforce_unit_edit_permissions()
returns trigger
language plpgsql
as $$
declare
  actor_role public.app_role := public.current_role();
  actor_team uuid := public.current_team_id();
  can_edit_non_owner boolean;
  can_edit_owner boolean;
  can_edit_pricing boolean;
  can_edit_commission boolean;
begin
  if old.remaining_payment is distinct from new.remaining_payment then
    raise exception 'Remaining Value can only change through the payment timetable.';
  end if;

  if old.payment_method is distinct from new.payment_method
    or old.down_payment is distinct from new.down_payment
    or old.installment_type is distinct from new.installment_type
    or old.installment_years is distinct from new.installment_years
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

  if not can_edit_pricing and old.total_amount is distinct from new.total_amount then
    raise exception 'You do not have permission to edit Total Value.';
  end if;

  if not can_edit_commission and old.commission_percentage is distinct from new.commission_percentage then
    raise exception 'You do not have permission to edit commission.';
  end if;

  return new;
end;
$$;

drop trigger if exists units_enforce_unit_edit_permissions on public.units;
create trigger units_enforce_unit_edit_permissions
before update on public.units
for each row execute function public.enforce_unit_edit_permissions();
