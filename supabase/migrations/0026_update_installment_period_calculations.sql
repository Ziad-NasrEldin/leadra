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
begin
  new.normalized_owner_phone := public.normalize_owner_phone(new.original_owner_phone, new.country_code);

  if tg_op = 'INSERT' then
    new.remaining_payment := case
      when new.payment_method = 'installment' then greatest(new.total_amount - coalesce(new.down_payment, 0), 0)
      else null
    end;
  else
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

    new.installment_amount := round(new.remaining_payment / nullif(payment_count, 0), 2);
  end if;

  select label into project_label from public.lookup_values where id = new.project_id;
  new.unit_code := public.project_unit_code(project_label, new.bedrooms);

  new.updated_at := now();
  return new;
end;
$$;
