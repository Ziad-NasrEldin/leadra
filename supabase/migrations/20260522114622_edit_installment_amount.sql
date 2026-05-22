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

  select coalesce(sum(amount) filter (where paid = false), 0)
    + case when coalesce(unit_row.maintenance_paid, false) then 0 else coalesce(unit_row.maintenance_cost, 0) end
  into next_remaining
  from public.unit_payment_schedule
  where unit_id = target_unit_id;

  perform set_config('leadra.payment_timetable_update', 'on', true);
  update public.units
  set remaining_payment = next_remaining
  where id = target_unit_id;

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
    'Installment amount updated',
    target_unit_id,
    jsonb_build_object('remainingPayment', previous_remaining, 'amount', schedule_row.amount),
    jsonb_build_object('remainingPayment', next_remaining, 'amount', normalized_amount, 'scheduleId', target_schedule_id)
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
    normalized_amount,
    unit_row.commission_amount,
    jsonb_build_object(
      'unitCode', unit_row.unit_code,
      'scheduleId', target_schedule_id,
      'action', 'amount_updated',
      'previousAmount', schedule_row.amount,
      'newAmount', normalized_amount,
      'previousRemainingValue', previous_remaining,
      'newRemainingValue', next_remaining
    )
  );
end;
$$;

grant execute on function public.set_unit_payment_amount(bigint, uuid, numeric) to authenticated;
