alter table public.units
  add column if not exists installment_due_day integer not null default 1
  check (installment_due_day between 1 and 31);

-- expose installment_due_day through safe unit RPCs
drop function if exists public.search_units_safe(jsonb, integer, integer);
drop function if exists public.list_units_safe(integer, integer);

create or replace function public.list_units_safe(limit_count integer default 500, offset_count integer default 0)
returns table (
  id bigint,
  unit_code text,
  developer_id uuid,
  developer_label text,
  project_id uuid,
  project_label text,
  destination_id uuid,
  destination_label text,
  unit_type text,
  floor text,
  bua numeric,
  roof_garden_area numeric,
  garden_area numeric,
  terrace_area numeric,
  view_id uuid,
  view_label text,
  bedrooms integer,
  bathrooms integer,
  elevator boolean,
  land_area numeric,
  furnished boolean,
  finish text,
  payment_method public.payment_method,
  total_amount numeric,
  down_payment numeric,
  remaining_payment numeric,
  transfer_fees numeric,
  maintenance_paid boolean,
  maintenance_cost numeric,
  maintenance_due_date date,
  commission_percentage numeric,
  commission_amount numeric,
  installment_type public.installment_type,
  installment_years integer,
  installment_start_month date,
  installment_end_month date,
  custom_installment_text text,
  installment_amount numeric,
  installment_due_day integer,
  delivery_month integer,
  delivery_year integer,
  original_owner_name text,
  country_code text,
  original_owner_phone text,
  normalized_owner_phone text,
  sales_notes text,
  status public.unit_status,
  archived boolean,
  is_special boolean,
  special_marked_at timestamptz,
  special_marked_by uuid,
  created_by uuid,
  creator_full_name text,
  team_id uuid,
  branch_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  unit_media jsonb,
  unit_notes jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select id, role
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
  select
    u.id,
    u.unit_code,
    u.developer_id,
    developer.label as developer_label,
    u.project_id,
    project.label as project_label,
    u.destination_id,
    destination.label as destination_label,
    u.unit_type,
    u.floor,
    u.bua,
    u.roof_garden_area,
    u.garden_area,
    u.terrace_area,
    u.view_id,
    view_lookup.label as view_label,
    u.bedrooms,
    u.bathrooms,
    u.elevator,
    u.land_area,
    u.furnished,
    u.finish,
    u.payment_method,
    u.total_amount,
    u.down_payment,
    u.remaining_payment,
    u.transfer_fees,
    u.maintenance_paid,
    u.maintenance_cost,
    u.maintenance_due_date,
    u.commission_percentage,
    u.commission_amount,
    u.installment_type,
    u.installment_years,
    u.installment_start_month,
    u.installment_end_month,
    u.custom_installment_text,
    u.installment_amount,
    u.installment_due_day,
    u.delivery_month,
    u.delivery_year,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.original_owner_name else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.country_code else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.original_owner_phone else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.normalized_owner_phone else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.sales_notes else null end,
    u.status,
    u.archived,
    u.is_special,
    u.special_marked_at,
    u.special_marked_by,
    u.created_by,
    creator.full_name,
    u.team_id,
    u.branch_id,
    u.created_at,
    u.updated_at,
    coalesce(media.items, '[]'::jsonb),
    coalesce(notes.items, '[]'::jsonb)
  from public.units u
  cross join actor
  left join public.lookup_values developer on developer.id = u.developer_id
  left join public.lookup_values project on project.id = u.project_id
  left join public.lookup_values destination on destination.id = u.destination_id
  left join public.lookup_values view_lookup on view_lookup.id = u.view_id
  left join public.profiles creator on creator.id = u.created_by
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', m.id, 'type', m.type, 'storage_path', case when m.storage_path like 'data:%' then '' else m.storage_path end, 'file_name', m.file_name, 'size_bytes', m.size_bytes, 'include_in_pdf', m.include_in_pdf) order by m.sort_order, m.created_at) as items
    from public.unit_media m
    where m.unit_id = u.id
  ) media on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content, 'created_by', n.created_by, 'created_by_role', n.created_by_role, 'created_at', n.created_at, 'creator_full_name', note_creator.full_name) order by n.created_at) as items
    from public.unit_notes n
    left join public.profiles note_creator on note_creator.id = n.created_by
    where n.unit_id = u.id
  ) notes on true
  where actor.role in ('admin', 'sub_admin', 'manager', 'sales')
  order by u.created_at desc
  limit least(greatest(coalesce(limit_count, 500), 1), 500)
  offset greatest(coalesce(offset_count, 0), 0);
$$;

grant execute on function public.list_units_safe(integer, integer) to authenticated;

create or replace function public.search_units_safe(
  filters jsonb default '{}'::jsonb,
  limit_count integer default 500,
  offset_count integer default 0
)
returns table (
  id bigint,
  unit_code text,
  developer_id uuid,
  developer_label text,
  project_id uuid,
  project_label text,
  destination_id uuid,
  destination_label text,
  unit_type text,
  floor text,
  bua numeric,
  roof_garden_area numeric,
  garden_area numeric,
  terrace_area numeric,
  view_id uuid,
  view_label text,
  bedrooms integer,
  bathrooms integer,
  elevator boolean,
  land_area numeric,
  furnished boolean,
  finish text,
  payment_method public.payment_method,
  total_amount numeric,
  down_payment numeric,
  remaining_payment numeric,
  transfer_fees numeric,
  maintenance_paid boolean,
  maintenance_cost numeric,
  maintenance_due_date date,
  commission_percentage numeric,
  commission_amount numeric,
  installment_type public.installment_type,
  installment_years integer,
  installment_start_month date,
  installment_end_month date,
  custom_installment_text text,
  installment_amount numeric,
  installment_due_day integer,
  delivery_month integer,
  delivery_year integer,
  original_owner_name text,
  country_code text,
  original_owner_phone text,
  normalized_owner_phone text,
  sales_notes text,
  status public.unit_status,
  archived boolean,
  is_special boolean,
  special_marked_at timestamptz,
  special_marked_by uuid,
  created_by uuid,
  creator_full_name text,
  team_id uuid,
  branch_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  unit_media jsonb,
  unit_notes jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with actor as (
    select role
    from public.profiles
    where id = auth.uid()
  ), safe_units as (
    select * from public.list_units_safe(5000, 0)
  ), filtered as (
    select su.*
    from safe_units su
    cross join actor
    where
      (coalesce(filters->>'unitCode', '') = '' or su.unit_code ilike '%' || (filters->>'unitCode') || '%')
      and (coalesce(filters->>'status', 'all') = 'all' or su.status::text = filters->>'status')
      and (coalesce(filters->>'developerId', '') = '' or su.developer_id = (filters->>'developerId')::uuid)
      and (coalesce(filters->>'destinationId', '') = '' or su.destination_id = (filters->>'destinationId')::uuid)
      and (coalesce(filters->>'projectId', '') = '' or su.project_id = (filters->>'projectId')::uuid)
      and (coalesce(filters->>'unitType', '') = '' or su.unit_type = filters->>'unitType')
      and (coalesce(filters->>'bedrooms', 'all') = 'all' or su.bedrooms = (filters->>'bedrooms')::integer)
      and (coalesce(filters->>'bathrooms', 'all') = 'all' or su.bathrooms = (filters->>'bathrooms')::integer)
      and (not (filters ? 'buaFrom') or su.bua >= (filters->>'buaFrom')::numeric)
      and (not (filters ? 'buaTo') or su.bua <= (filters->>'buaTo')::numeric)
      and (not (filters ? 'landAreaFrom') or su.land_area >= (filters->>'landAreaFrom')::numeric)
      and (not (filters ? 'landAreaTo') or su.land_area <= (filters->>'landAreaTo')::numeric)
      and (not (filters ? 'gardenAreaFrom') or su.garden_area >= (filters->>'gardenAreaFrom')::numeric)
      and (not (filters ? 'gardenAreaTo') or su.garden_area <= (filters->>'gardenAreaTo')::numeric)
      and (not (filters ? 'terraceAreaFrom') or su.terrace_area >= (filters->>'terraceAreaFrom')::numeric)
      and (not (filters ? 'terraceAreaTo') or su.terrace_area <= (filters->>'terraceAreaTo')::numeric)
      and (not (filters ? 'priceFrom') or su.total_amount >= (filters->>'priceFrom')::numeric)
      and (not (filters ? 'priceTo') or su.total_amount <= (filters->>'priceTo')::numeric)
      and (coalesce(filters->>'paymentMethod', 'all') = 'all' or su.payment_method::text = filters->>'paymentMethod')
      and (not (filters ? 'cashPriceFrom') or (su.payment_method = 'cash' and su.total_amount >= (filters->>'cashPriceFrom')::numeric))
      and (not (filters ? 'cashPriceTo') or (su.payment_method = 'cash' and su.total_amount <= (filters->>'cashPriceTo')::numeric))
      and (not (filters ? 'downPaymentFrom') or su.down_payment >= (filters->>'downPaymentFrom')::numeric)
      and (not (filters ? 'downPaymentTo') or su.down_payment <= (filters->>'downPaymentTo')::numeric)
      and (not (filters ? 'remainingPaymentFrom') or su.remaining_payment >= (filters->>'remainingPaymentFrom')::numeric)
      and (not (filters ? 'remainingPaymentTo') or su.remaining_payment <= (filters->>'remainingPaymentTo')::numeric)
      and (coalesce(filters->>'installmentType', 'all') = 'all' or su.installment_type::text = filters->>'installmentType')
      and (not (filters ? 'installmentAmountFrom') or su.installment_amount >= (filters->>'installmentAmountFrom')::numeric)
      and (not (filters ? 'installmentAmountTo') or su.installment_amount <= (filters->>'installmentAmountTo')::numeric)
      and (coalesce(filters->>'deliveryYear', 'all') = 'all' or su.delivery_year = (filters->>'deliveryYear')::integer)
      and (coalesce(filters->>'deliveryMonth', 'all') = 'all' or su.delivery_month = (filters->>'deliveryMonth')::integer)
      and (
        coalesce(filters->>'ownerPhone', '') = ''
        or (
          actor.role in ('admin', 'sub_admin')
          and coalesce(su.normalized_owner_phone, '') like '%' || regexp_replace(filters->>'ownerPhone', '[^0-9+]', '', 'g') || '%'
        )
      )
    order by su.created_at desc
  )
  select *
  from filtered
  limit least(greatest(coalesce(limit_count, 500), 1), 500)
  offset greatest(coalesce(offset_count, 0), 0);
$$;

grant execute on function public.search_units_safe(jsonb, integer, integer) to authenticated;

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
  can_manage_special := actor_role in ('admin', 'sub_admin');

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
    or old.installment_due_day is distinct from new.installment_due_day
  ) then
    raise exception 'You do not have permission to edit Total Value.';
  end if;

  if not can_edit_commission and old.commission_percentage is distinct from new.commission_percentage then
    raise exception 'You do not have permission to edit commission.';
  end if;

  return new;
end;
$$;

create or replace function public.set_unit_payment_amount(
  target_unit_id bigint,
  target_schedule_id uuid,
  new_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
  schedule_row public.unit_payment_schedule%rowtype;
  unit_row public.units%rowtype;
  previous_remaining numeric(14,2);
  next_remaining numeric(14,2);
  next_total numeric(14,2);
  normalized_amount numeric(14,2);
begin
  if actor_role is null then
    raise exception 'You must be signed in to update payment timetable.';
  end if;

  if actor_role not in ('admin', 'sub_admin', 'sales') then
    raise exception 'You cannot edit this payment timetable.';
  end if;

  if new_amount is null or new_amount <= 0 then
    raise exception 'Installment amount must be greater than zero.';
  end if;

  normalized_amount := round(new_amount, 2);

  select * into unit_row
  from public.units
  where id = target_unit_id and archived = false
  for update;
  if not found then
    raise exception 'Unit not found.';
  end if;

  if actor_role = 'sales' and unit_row.created_by <> auth.uid() then
    raise exception 'You cannot edit this payment timetable.';
  end if;

  select * into schedule_row
  from public.unit_payment_schedule
  where id = target_schedule_id and unit_id = target_unit_id
  for update;
  if not found then
    raise exception 'Payment timetable row not found.';
  end if;

  if schedule_row.amount = normalized_amount then
    return;
  end if;

  previous_remaining := coalesce(unit_row.remaining_payment, 0);

  update public.unit_payment_schedule
  set amount = normalized_amount,
      updated_at = now()
  where id = target_schedule_id;

  select
    coalesce(sum(amount) filter (where paid = false), 0)
      + case when coalesce(unit_row.maintenance_paid, false) then 0 else coalesce(unit_row.maintenance_cost, 0) end,
    coalesce(unit_row.down_payment, 0) + coalesce(sum(amount), 0)
  into next_remaining, next_total
  from public.unit_payment_schedule
  where unit_id = target_unit_id;

  perform set_config('leadra.payment_timetable_update', 'on', true);
  update public.units
  set remaining_payment = next_remaining,
      total_amount = next_total
  where id = target_unit_id;

  insert into public.audit_logs (actor_id, actor_role, action_type, related_unit_id, previous_value, new_value)
  values (
    auth.uid(),
    actor_role,
    'Installment amount updated',
    target_unit_id,
    jsonb_build_object('remainingPayment', previous_remaining, 'amount', schedule_row.amount),
    jsonb_build_object('remainingPayment', next_remaining, 'amount', normalized_amount, 'scheduleId', target_schedule_id, 'totalAmount', next_total)
  );

  insert into public.analytics_events (
    event_type, actor_id, actor_role, team_id, branch_id, unit_id, project_id,
    developer_id, destination_id, amount_value, commission_value, metadata
  )
  values (
    'installment_updated',
    auth.uid(),
    actor_role,
    unit_row.team_id,
    unit_row.branch_id,
    target_unit_id,
    unit_row.project_id,
    unit_row.developer_id,
    unit_row.destination_id,
    normalized_amount,
    round(next_total * unit_row.commission_percentage / 100, 2),
    jsonb_build_object('unitCode', unit_row.unit_code, 'scheduleId', target_schedule_id, 'action', 'amount_updated', 'previousAmount', schedule_row.amount, 'newAmount', normalized_amount, 'previousRemainingValue', previous_remaining, 'newRemainingValue', next_remaining)
  );
end;
$$;

grant execute on function public.set_unit_payment_amount(bigint, uuid, numeric) to authenticated;

create or replace function public.reconcile_due_unit_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
  schedule_row public.unit_payment_schedule%rowtype;
  unit_row public.units%rowtype;
  previous_remaining numeric(14,2);
  next_remaining numeric(14,2);
  reconciled_count integer := 0;
begin
  if actor_role is null then
    raise exception 'You must be signed in to reconcile payment timetable.';
  end if;

  for schedule_row in
    select s.*
    from public.unit_payment_schedule s
    join public.units u on u.id = s.unit_id
    where s.paid = false
      and s.due_month is not null
      and make_date(
        extract(year from s.due_month)::integer,
        extract(month from s.due_month)::integer,
        least(u.installment_due_day, extract(day from (date_trunc('month', s.due_month) + interval '1 month - 1 day'))::integer)
      ) <= current_date
    order by s.unit_id, s.payment_number
    for update of s
  loop
    select * into unit_row
    from public.units
    where id = schedule_row.unit_id and archived = false
    for update;

    if not found then
      continue;
    end if;

    previous_remaining := coalesce(unit_row.remaining_payment, 0);

    update public.unit_payment_schedule
    set paid = true,
        paid_at = now(),
        paid_by = auth.uid(),
        updated_at = now()
    where id = schedule_row.id;

    select coalesce(sum(amount) filter (where paid = false), 0)
      + case when coalesce(unit_row.maintenance_paid, false) then 0 else coalesce(unit_row.maintenance_cost, 0) end
    into next_remaining
    from public.unit_payment_schedule
    where unit_id = schedule_row.unit_id;

    perform set_config('leadra.payment_timetable_update', 'on', true);
    update public.units
    set remaining_payment = next_remaining
    where id = schedule_row.unit_id;

    insert into public.unit_payment_history (unit_id, schedule_id, action, amount, previous_remaining_value, new_remaining_value, actor_id)
    values (schedule_row.unit_id, schedule_row.id, 'paid', schedule_row.amount, previous_remaining, next_remaining, auth.uid());

    insert into public.audit_logs (actor_id, actor_role, action_type, related_unit_id, previous_value, new_value)
    values (
      auth.uid(),
      actor_role,
      'Payment auto-marked paid',
      schedule_row.unit_id,
      jsonb_build_object('remainingPayment', previous_remaining),
      jsonb_build_object('remainingPayment', next_remaining, 'amount', schedule_row.amount, 'scheduleId', schedule_row.id, 'action', 'paid')
    );

    insert into public.analytics_events (
      event_type, actor_id, actor_role, team_id, branch_id, unit_id, project_id,
      developer_id, destination_id, amount_value, commission_value, metadata
    )
    values (
      'installment_updated',
      auth.uid(),
      actor_role,
      unit_row.team_id,
      unit_row.branch_id,
      schedule_row.unit_id,
      unit_row.project_id,
      unit_row.developer_id,
      unit_row.destination_id,
      schedule_row.amount,
      unit_row.commission_amount,
      jsonb_build_object('unitCode', unit_row.unit_code, 'scheduleId', schedule_row.id, 'action', 'auto_paid', 'previousRemainingValue', previous_remaining, 'newRemainingValue', next_remaining)
    );

    reconciled_count := reconciled_count + 1;
  end loop;

  return reconciled_count;
end;
$$;

grant execute on function public.reconcile_due_unit_payments() to authenticated;
