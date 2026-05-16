create or replace function public.unique_project_unit_code(project_label text, bedrooms integer, current_unit_id bigint default null)
returns text
language plpgsql
volatile
as $$
declare
  base_code text := public.project_unit_code(project_label, bedrooms);
  candidate text;
  suffix integer := 2;
begin
  perform pg_advisory_xact_lock(hashtextextended(base_code, 0));

  candidate := base_code;
  loop
    if not exists (
      select 1
      from public.units
      where unit_code = candidate
        and (current_unit_id is null or id <> current_unit_id)
    ) then
      return candidate;
    end if;

    candidate := base_code || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;
end;
$$;

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
