create or replace function public.prepare_unit_calculations()
returns trigger
language plpgsql
as $$
declare
  project_label text;
  payments_per_year integer;
  step_months integer;
  start_month_index integer;
  end_month_index integer;
  payment_count integer;
  base_remaining numeric(14,2);
  unpaid_schedule_remaining numeric(14,2);
  has_paid_schedule boolean;
  unpaid_maintenance numeric(14,2);
  timetable_update boolean := coalesce(current_setting('leadra.payment_timetable_update', true), '') = 'on';
begin
  new.normalized_owner_phone := public.normalize_owner_phone(new.original_owner_phone, new.country_code);
  unpaid_maintenance := case when coalesce(new.maintenance_paid, false) then 0 else coalesce(new.maintenance_cost, 0) end;

  if new.payment_method = 'cash' then
    new.down_payment := null;
    new.remaining_payment := null;
    new.installment_type := null;
    new.installment_years := null;
    new.installment_start_month := null;
    new.installment_end_month := null;
    new.custom_installment_text := null;
    new.installment_amount := null;
  elsif new.installment_type = 'custom' then
    new.installment_years := null;
    new.installment_start_month := null;
    new.installment_end_month := null;
    new.custom_installment_text := nullif(btrim(new.custom_installment_text), '');
    new.installment_amount := null;
    if tg_op = 'INSERT' then
      new.remaining_payment := greatest(new.total_amount - coalesce(new.down_payment, 0), 0) + unpaid_maintenance;
    elsif not timetable_update then
      new.remaining_payment := coalesce(old.remaining_payment, 0) + unpaid_maintenance - case when coalesce(old.maintenance_paid, false) then 0 else coalesce(old.maintenance_cost, 0) end;
    end if;
  else
    new.custom_installment_text := null;
    step_months := case new.installment_type::text when 'monthly' then 1 when 'quarterly' then 3 when 'semi_annual' then 6 when 'annual' then 12 else null end;
    payments_per_year := case new.installment_type::text when 'monthly' then 12 when 'quarterly' then 4 when 'semi_annual' then 2 when 'annual' then 1 else null end;
    base_remaining := greatest(new.total_amount - coalesce(new.down_payment, 0), 0);

    if new.installment_start_month is not null and new.installment_end_month is not null and step_months is not null then
      start_month_index := (extract(year from new.installment_start_month)::integer * 12) + extract(month from new.installment_start_month)::integer - 1;
      end_month_index := (extract(year from new.installment_end_month)::integer * 12) + extract(month from new.installment_end_month)::integer - 1;
      payment_count := floor((end_month_index - start_month_index)::numeric / step_months)::integer + 1;
      new.installment_years := null;
    else
      payment_count := coalesce(new.installment_years, 0) * coalesce(payments_per_year, 0);
    end if;

    if timetable_update and tg_op = 'UPDATE' then
      new.installment_amount := old.installment_amount;
    else
      new.installment_amount := round(base_remaining / nullif(payment_count, 0), 2);
    end if;

    if tg_op = 'INSERT' then
      new.remaining_payment := base_remaining + unpaid_maintenance;
    elsif not timetable_update then
      select
        coalesce(sum(amount) filter (where paid = false), 0),
        coalesce(bool_or(paid), false)
      into unpaid_schedule_remaining, has_paid_schedule
      from public.unit_payment_schedule
      where unit_id = old.id;

      if has_paid_schedule then
        new.remaining_payment := unpaid_schedule_remaining + unpaid_maintenance;
      else
        new.remaining_payment := base_remaining + unpaid_maintenance;
      end if;
    end if;
  end if;

  select label into project_label from public.lookup_values where id = new.project_id;
  if tg_op = 'INSERT' then
    new.unit_code := public.unique_project_unit_code(project_label, new.bedrooms, new.id);
  elsif new.unit_code is null
    or new.project_id is distinct from old.project_id
    or new.bedrooms is distinct from old.bedrooms then
    new.unit_code := public.unique_project_unit_code(project_label, new.bedrooms, new.id);
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
  actor_role public.user_role := public.current_role();
  actor_team uuid := public.current_team_id();
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
    or (actor_role = 'manager' and old.team_id = actor_team)
    or (actor_role = 'sales' and old.created_by = auth.uid() and old.archived = false);
  can_edit_owner := actor_role in ('admin', 'sub_admin');
  can_edit_pricing :=
    actor_role in ('admin', 'sub_admin')
    or (actor_role = 'sales' and old.created_by = auth.uid() and old.archived = false);
  can_edit_commission := actor_role in ('admin', 'sub_admin');
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
