create or replace function public.project_unit_code(project_label text, bedrooms integer)
returns text
language plpgsql
immutable
as $$
declare
  words text[];
  abbreviation text;
begin
  words := regexp_split_to_array(trim(coalesce(project_label, '')), '[^A-Za-z0-9]+');
  words := array(select word from unnest(words) as word where word <> '');

  if array_length(words, 1) >= 2 then
    abbreviation := upper(left(words[1], 1) || left(words[2], 1));
  elsif array_length(words, 1) = 1 then
    abbreviation := upper(rpad(left(words[1], 2), 2, 'X'));
  else
    abbreviation := 'PR';
  end if;

  return abbreviation || bedrooms::text || 'BR';
end;
$$;

create or replace function public.prepare_unit_calculations()
returns trigger
language plpgsql
as $$
declare
  project_label text;
  payments_per_year integer;
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
    new.installment_amount := null;
  elsif new.installment_type = 'custom' then
    new.installment_amount := null;
  else
    payments_per_year := case new.installment_type when 'quarterly' then 4 when 'semi_annual' then 2 when 'annual' then 1 else null end;
    new.installment_amount := round(new.remaining_payment / nullif((coalesce(new.installment_years, 0) * payments_per_year), 0), 2);
  end if;

  select label into project_label from public.lookup_values where id = new.project_id;
  new.unit_code := public.project_unit_code(project_label, new.bedrooms);

  new.updated_at := now();
  return new;
end;
$$;
