alter table public.units
  add column if not exists garden_area numeric(12,2),
  add column if not exists terrace_area numeric(12,2);

alter table public.units
  drop constraint if exists units_unit_code_key;

insert into public.lookup_values (kind, label)
values
  ('unit_type', 'One Story Villa'),
  ('unit_type', 'Stand Alone'),
  ('unit_type', 'Twin House'),
  ('unit_type', 'Town House'),
  ('unit_type', 'Apartment'),
  ('unit_type', 'Chalet'),
  ('unit_type', 'Duplex'),
  ('unit_type', 'Senior Chalet'),
  ('unit_type', 'Junior Chalet'),
  ('unit_type', 'Loft'),
  ('unit_type', 'Cabin'),
  ('unit_type', 'Penthouse')
on conflict (kind, label) do nothing;

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

create or replace function public.set_unit_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_label text;
begin
  if new.remaining_payment is null and new.payment_method = 'installment' then
    new.remaining_payment := greatest(new.total_amount - coalesce(new.down_payment, 0), 0);
  end if;

  if new.installment_amount is null and new.payment_method = 'installment' and new.installment_years is not null then
    new.installment_amount := case
      when new.installment_type = 'quarterly' then new.remaining_payment / (new.installment_years * 4)
      when new.installment_type = 'semi_annual' then new.remaining_payment / (new.installment_years * 2)
      when new.installment_type = 'annual' then new.remaining_payment / new.installment_years
      else null
    end;
  end if;

  select label into project_label from public.lookup_values where id = new.project_id;
  new.unit_code := public.project_unit_code(project_label, new.bedrooms);

  if new.unit_type in ('One Story Villa', 'Stand Alone', 'Twin House', 'Town House') then
    new.floor := '';
    new.garden_area := null;
    new.terrace_area := null;
    new.roof_garden_area := null;
  elsif new.unit_type = 'Cabin' then
    new.floor := '';
    new.land_area := null;
    new.garden_area := null;
    new.terrace_area := null;
    new.roof_garden_area := null;
  elsif new.unit_type = 'Penthouse' then
    new.floor := '';
    new.land_area := null;
    new.garden_area := null;
    new.terrace_area := coalesce(new.terrace_area, new.roof_garden_area);
    new.roof_garden_area := new.terrace_area;
  else
    new.land_area := null;
    new.terrace_area := null;
    new.garden_area := case when new.floor = 'Ground' then coalesce(new.garden_area, new.roof_garden_area) else null end;
    new.roof_garden_area := new.garden_area;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.list_units_safe(limit_count integer default 500, offset_count integer default 0)
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
security definer
set search_path = public
as $$
  with actor as (
    select id, role
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
  select
    u.id,
    u.unit_code,
    u.developer_id,
    developer.label as developer_label,
    u.project_id,
    project.label as project_label,
    u.destination_id,
    destination.label as destination_label,
    u.unit_type,
    u.floor,
    u.bua,
    u.roof_garden_area,
    u.garden_area,
    u.terrace_area,
    u.view_id,
    view_lookup.label as view_label,
    u.bedrooms,
    u.bathrooms,
    u.elevator,
    u.land_area,
    u.furnished,
    u.finish,
    u.payment_method,
    u.total_amount,
    u.down_payment,
    u.remaining_payment,
    u.commission_percentage,
    u.commission_amount,
    u.installment_type,
    u.installment_years,
    u.installment_amount,
    u.delivery_month,
    u.delivery_year,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.original_owner_name else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.country_code else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.original_owner_phone else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.normalized_owner_phone else null end,
    case when actor.role in ('admin', 'sub_admin') or (actor.role = 'sales' and u.created_by = actor.id) then u.sales_notes else null end,
    u.status,
    u.archived,
    u.created_by,
    creator.full_name,
    u.team_id,
    u.branch_id,
    u.created_at,
    u.updated_at,
    coalesce(media.items, '[]'::jsonb),
    coalesce(notes.items, '[]'::jsonb)
  from public.units u
  cross join actor
  left join public.lookup_values developer on developer.id = u.developer_id
  left join public.lookup_values project on project.id = u.project_id
  left join public.lookup_values destination on destination.id = u.destination_id
  left join public.lookup_values view_lookup on view_lookup.id = u.view_id
  left join public.profiles creator on creator.id = u.created_by
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', m.id, 'type', m.type, 'storage_path', m.storage_path, 'file_name', m.file_name, 'size_bytes', m.size_bytes) order by m.sort_order, m.created_at) as items
    from public.unit_media m
    where m.unit_id = u.id
  ) media on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content, 'created_by', n.created_by, 'created_by_role', n.created_by_role, 'created_at', n.created_at, 'creator_full_name', note_creator.full_name) order by n.created_at) as items
    from public.unit_notes n
    left join public.profiles note_creator on note_creator.id = n.created_by
    where n.unit_id = u.id
  ) notes on true
  where actor.role in ('admin', 'sub_admin', 'manager', 'sales')
  order by u.created_at desc
  limit least(greatest(coalesce(limit_count, 500), 1), 500)
  offset greatest(coalesce(offset_count, 0), 0);
$$;

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

grant execute on function public.list_units_safe(integer, integer) to authenticated;
grant execute on function public.search_units_safe(jsonb, integer, integer) to authenticated;
