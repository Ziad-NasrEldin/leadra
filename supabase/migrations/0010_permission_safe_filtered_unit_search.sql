create index if not exists units_destination_project_idx
  on public.units (destination_id, project_id, created_at desc)
  where archived = false;

create index if not exists units_developer_status_idx
  on public.units (developer_id, status, created_at desc)
  where archived = false;

create index if not exists units_specs_search_idx
  on public.units (unit_type, bedrooms, bathrooms, bua)
  where archived = false;

create index if not exists units_payment_search_idx
  on public.units (payment_method, total_amount, down_payment, remaining_payment, installment_type, installment_amount)
  where archived = false;

create index if not exists units_delivery_search_idx
  on public.units (delivery_year, delivery_month)
  where archived = false;

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
  commission_percentage numeric,
  commission_amount numeric,
  installment_type public.installment_type,
  installment_years integer,
  installment_amount numeric,
  delivery_month integer,
  delivery_year integer,
  original_owner_name text,
  country_code text,
  original_owner_phone text,
  normalized_owner_phone text,
  sales_notes text,
  status public.unit_status,
  archived boolean,
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
  with safe_units as (
    select *
    from public.list_units_safe(5000, 0)
  ), filtered as (
    select su.*
    from safe_units su
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
        or coalesce(su.normalized_owner_phone, '') like '%' || regexp_replace(filters->>'ownerPhone', '[^0-9+]', '', 'g') || '%'
      )
    order by su.created_at desc
  )
  select *
  from filtered
  limit least(greatest(coalesce(limit_count, 500), 1), 500)
  offset greatest(coalesce(offset_count, 0), 0);
$$;

grant execute on function public.search_units_safe(jsonb, integer, integer) to authenticated;
