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
      and (coalesce(filters->>'floor', '') = '' or su.floor = filters->>'floor')
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
      and (not (filters ? 'deliveryYearFrom') or su.delivery_year >= (filters->>'deliveryYearFrom')::integer)
      and (not (filters ? 'deliveryYearTo') or su.delivery_year <= (filters->>'deliveryYearTo')::integer)
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
