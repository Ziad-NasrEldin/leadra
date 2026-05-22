alter type public.media_type add value if not exists 'pdf';

alter table public.unit_media
  add column if not exists include_in_pdf boolean not null default true;

update public.unit_media
set include_in_pdf = false
where type <> 'image';

create or replace function public.create_unit_with_media(unit_payload jsonb, media_payload jsonb default '[]'::jsonb)
returns bigint
language plpgsql
volatile
set search_path = public
as $$
declare
  created_unit_id bigint;
begin
  if jsonb_typeof(coalesce(media_payload, '[]'::jsonb)) <> 'array' then
    raise exception 'media_payload must be an array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(media_payload, '[]'::jsonb)) as media(item)
    where media.item->>'type' not in ('image', 'pdf')
  ) then
    raise exception 'Only image and PDF media can be attached to a unit' using errcode = '22023';
  end if;

  insert into public.units (
    developer_id,
    project_id,
    destination_id,
    unit_type,
    floor,
    bua,
    roof_garden_area,
    garden_area,
    terrace_area,
    view_id,
    bedrooms,
    bathrooms,
    elevator,
    land_area,
    furnished,
    finish,
    payment_method,
    total_amount,
    down_payment,
    transfer_fees,
    maintenance_paid,
    maintenance_cost,
    maintenance_due_date,
    installment_type,
    installment_years,
    installment_start_month,
    installment_end_month,
    custom_installment_text,
    delivery_month,
    delivery_year,
    original_owner_name,
    country_code,
    original_owner_phone,
    sales_notes,
    created_by,
    team_id,
    branch_id
  )
  values (
    (unit_payload->>'developer_id')::uuid,
    (unit_payload->>'project_id')::uuid,
    (unit_payload->>'destination_id')::uuid,
    unit_payload->>'unit_type',
    unit_payload->>'floor',
    (unit_payload->>'bua')::numeric,
    nullif(unit_payload->>'roof_garden_area', '')::numeric,
    nullif(unit_payload->>'garden_area', '')::numeric,
    nullif(unit_payload->>'terrace_area', '')::numeric,
    (unit_payload->>'view_id')::uuid,
    (unit_payload->>'bedrooms')::integer,
    (unit_payload->>'bathrooms')::integer,
    coalesce((unit_payload->>'elevator')::boolean, false),
    nullif(unit_payload->>'land_area', '')::numeric,
    coalesce((unit_payload->>'furnished')::boolean, false),
    unit_payload->>'finish',
    (unit_payload->>'payment_method')::public.payment_method,
    (unit_payload->>'total_amount')::numeric,
    nullif(unit_payload->>'down_payment', '')::numeric,
    nullif(unit_payload->>'transfer_fees', '')::numeric,
    coalesce((unit_payload->>'maintenance_paid')::boolean, false),
    nullif(unit_payload->>'maintenance_cost', '')::numeric,
    nullif(unit_payload->>'maintenance_due_date', '')::date,
    nullif(unit_payload->>'installment_type', '')::public.installment_type,
    nullif(unit_payload->>'installment_years', '')::integer,
    nullif(unit_payload->>'installment_start_month', '')::date,
    nullif(unit_payload->>'installment_end_month', '')::date,
    nullif(unit_payload->>'custom_installment_text', ''),
    nullif(unit_payload->>'delivery_month', '')::integer,
    (unit_payload->>'delivery_year')::integer,
    unit_payload->>'original_owner_name',
    unit_payload->>'country_code',
    unit_payload->>'original_owner_phone',
    coalesce(unit_payload->>'sales_notes', ''),
    (unit_payload->>'created_by')::uuid,
    nullif(unit_payload->>'team_id', '')::uuid,
    nullif(unit_payload->>'branch_id', '')::uuid
  )
  returning id into created_unit_id;

  insert into public.unit_media (
    unit_id,
    type,
    storage_path,
    file_name,
    size_bytes,
    include_in_pdf,
    sort_order
  )
  select
    created_unit_id,
    (media.item->>'type')::public.media_type,
    media.item->>'storage_path',
    media.item->>'file_name',
    (media.item->>'size_bytes')::bigint,
    case
      when media.item->>'type' = 'image' then coalesce((media.item->>'include_in_pdf')::boolean, true)
      else false
    end,
    media.ordinality::integer - 1
  from jsonb_array_elements(coalesce(media_payload, '[]'::jsonb)) with ordinality as media(item, ordinality);

  return created_unit_id;
end;
$$;

grant execute on function public.create_unit_with_media(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
