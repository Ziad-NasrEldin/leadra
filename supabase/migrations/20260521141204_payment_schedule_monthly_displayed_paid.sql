alter type public.installment_type add value if not exists 'monthly' before 'quarterly';

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
      select coalesce(sum(amount) filter (where paid = false), 0)
      into unpaid_schedule_remaining
      from public.unit_payment_schedule
      where unit_id = old.id;
      new.remaining_payment := coalesce(nullif(unpaid_schedule_remaining, 0), base_remaining) + unpaid_maintenance;
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

  step_months := case unit_row.installment_type::text when 'monthly' then 1 when 'quarterly' then 3 when 'semi_annual' then 6 when 'annual' then 12 else null end;
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

  select * into unit_row from public.units where id = target_unit_id and archived = false for update;
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
    + case when coalesce(unit_row.maintenance_paid, false) then 0 else coalesce(unit_row.maintenance_cost, 0) end
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
    select *
    from public.unit_payment_schedule
    where paid = false
      and due_month is not null
      and due_month <= date_trunc('month', current_date)::date
    order by unit_id, payment_number
    for update
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
      schedule_row.unit_id,
      schedule_row.id,
      'paid',
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
      'Payment auto-marked paid',
      schedule_row.unit_id,
      jsonb_build_object('remainingPayment', previous_remaining),
      jsonb_build_object('remainingPayment', next_remaining, 'amount', schedule_row.amount, 'scheduleId', schedule_row.id, 'action', 'paid')
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
