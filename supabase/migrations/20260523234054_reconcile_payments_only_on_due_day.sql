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
      ) = current_date
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
