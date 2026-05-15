create table if not exists public.unit_payment_schedule (
  id uuid primary key default gen_random_uuid(),
  unit_id bigint not null references public.units(id) on delete cascade,
  payment_number integer not null,
  due_month date,
  amount numeric(14,2) not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, payment_number)
);

create table if not exists public.unit_payment_history (
  id uuid primary key default gen_random_uuid(),
  unit_id bigint not null references public.units(id) on delete cascade,
  schedule_id uuid not null references public.unit_payment_schedule(id) on delete cascade,
  action text not null check (action in ('paid', 'unpaid')),
  amount numeric(14,2) not null check (amount >= 0),
  previous_remaining_value numeric(14,2) not null check (previous_remaining_value >= 0),
  new_remaining_value numeric(14,2) not null check (new_remaining_value >= 0),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists unit_payment_schedule_unit_idx on public.unit_payment_schedule (unit_id, payment_number);
create index if not exists unit_payment_history_unit_idx on public.unit_payment_history (unit_id, created_at desc);

alter table public.unit_payment_schedule enable row level security;
alter table public.unit_payment_history enable row level security;

drop policy if exists "active users read payment schedule" on public.unit_payment_schedule;
create policy "active users read payment schedule" on public.unit_payment_schedule
for select using (public.current_role() is not null);

drop policy if exists "active users read payment history" on public.unit_payment_history;
create policy "active users read payment history" on public.unit_payment_history
for select using (public.current_role() is not null);

grant select on public.unit_payment_schedule to authenticated;
grant select on public.unit_payment_history to authenticated;

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
  timetable_update boolean := coalesce(current_setting('leadra.payment_timetable_update', true), '') = 'on';
begin
  new.normalized_owner_phone := public.normalize_owner_phone(new.original_owner_phone, new.country_code);

  if tg_op = 'INSERT' then
    new.remaining_payment := case
      when new.payment_method = 'installment' then greatest(new.total_amount - coalesce(new.down_payment, 0), 0)
      else null
    end;
  elsif not timetable_update then
    new.remaining_payment := old.remaining_payment;
  end if;

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
  else
    new.custom_installment_text := null;
    step_months := case new.installment_type when 'quarterly' then 3 when 'semi_annual' then 6 when 'annual' then 12 else null end;
    payments_per_year := case new.installment_type when 'quarterly' then 4 when 'semi_annual' then 2 when 'annual' then 1 else null end;

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
      new.installment_amount := round(new.remaining_payment / nullif(payment_count, 0), 2);
    end if;
  end if;

  select label into project_label from public.lookup_values where id = new.project_id;
  new.unit_code := public.project_unit_code(project_label, new.bedrooms);

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

create or replace function public.regenerate_unit_payment_schedule(target_unit_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_row public.units%rowtype;
  step_months integer;
  current_month date;
  next_payment_number integer := 1;
begin
  select * into unit_row from public.units where id = target_unit_id;
  if not found then
    return;
  end if;

  if unit_row.payment_method <> 'installment'
    or unit_row.installment_type = 'custom'
    or unit_row.installment_start_month is null
    or unit_row.installment_end_month is null
    or unit_row.installment_amount is null then
    delete from public.unit_payment_schedule where unit_id = target_unit_id and paid = false;
    return;
  end if;

  if exists (select 1 from public.unit_payment_schedule where unit_id = target_unit_id and paid = true) then
    return;
  end if;

  delete from public.unit_payment_schedule where unit_id = target_unit_id;

  step_months := case unit_row.installment_type when 'quarterly' then 3 when 'semi_annual' then 6 when 'annual' then 12 else null end;
  current_month := unit_row.installment_start_month;

  while current_month <= unit_row.installment_end_month loop
    insert into public.unit_payment_schedule (unit_id, payment_number, due_month, amount)
    values (target_unit_id, next_payment_number, current_month, unit_row.installment_amount)
    on conflict (unit_id, payment_number) do update
      set due_month = excluded.due_month,
          amount = excluded.amount,
          updated_at = now();
    next_payment_number := next_payment_number + 1;
    current_month := (current_month + make_interval(months => step_months))::date;
  end loop;
end;
$$;

create or replace function public.sync_unit_payment_schedule()
returns trigger
language plpgsql
as $$
begin
  perform public.regenerate_unit_payment_schedule(new.id);
  return new;
end;
$$;

drop trigger if exists units_sync_payment_schedule on public.units;
create trigger units_sync_payment_schedule
after insert or update of payment_method, installment_type, installment_start_month, installment_end_month, installment_amount
on public.units
for each row execute function public.sync_unit_payment_schedule();

create or replace function public.set_unit_payment_paid(
  target_unit_id bigint,
  target_schedule_id uuid,
  mark_paid boolean
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
  action_text text;
begin
  if actor_role is null then
    raise exception 'You must be signed in to update payment timetable.';
  end if;

  select * into unit_row from public.units where id = target_unit_id and archived = false;
  if not found then
    raise exception 'Unit not found.';
  end if;

  select * into schedule_row
  from public.unit_payment_schedule
  where id = target_schedule_id and unit_id = target_unit_id
  for update;
  if not found then
    raise exception 'Payment timetable row not found.';
  end if;

  if schedule_row.paid = mark_paid then
    return;
  end if;

  previous_remaining := coalesce(unit_row.remaining_payment, 0);
  update public.unit_payment_schedule
  set paid = mark_paid,
      paid_at = case when mark_paid then now() else null end,
      paid_by = case when mark_paid then auth.uid() else null end,
      updated_at = now()
  where id = target_schedule_id;

  select coalesce(sum(amount) filter (where paid = false), 0)
  into next_remaining
  from public.unit_payment_schedule
  where unit_id = target_unit_id;

  perform set_config('leadra.payment_timetable_update', 'on', true);
  update public.units
  set remaining_payment = next_remaining
  where id = target_unit_id;

  action_text := case when mark_paid then 'paid' else 'unpaid' end;
  insert into public.unit_payment_history (
    unit_id,
    schedule_id,
    action,
    amount,
    previous_remaining_value,
    new_remaining_value,
    actor_id
  )
  values (
    target_unit_id,
    target_schedule_id,
    action_text,
    schedule_row.amount,
    previous_remaining,
    next_remaining,
    auth.uid()
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action_type,
    related_unit_id,
    previous_value,
    new_value
  )
  values (
    auth.uid(),
    actor_role,
    case when mark_paid then 'Payment marked paid' else 'Payment marked unpaid' end,
    target_unit_id,
    jsonb_build_object('remainingPayment', previous_remaining),
    jsonb_build_object('remainingPayment', next_remaining, 'amount', schedule_row.amount, 'scheduleId', target_schedule_id, 'action', action_text)
  );

  insert into public.analytics_events (
    event_type,
    actor_id,
    actor_role,
    team_id,
    branch_id,
    unit_id,
    project_id,
    developer_id,
    destination_id,
    amount_value,
    commission_value,
    metadata
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
    schedule_row.amount,
    unit_row.commission_amount,
    jsonb_build_object('unitCode', unit_row.unit_code, 'scheduleId', target_schedule_id, 'action', action_text, 'previousRemainingValue', previous_remaining, 'newRemainingValue', next_remaining)
  );
end;
$$;

grant execute on function public.regenerate_unit_payment_schedule(bigint) to authenticated;
grant execute on function public.set_unit_payment_paid(bigint, uuid, boolean) to authenticated;

select public.regenerate_unit_payment_schedule(id)
from public.units
where payment_method = 'installment'
  and installment_type <> 'custom';
