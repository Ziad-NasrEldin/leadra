create index if not exists units_visible_created_idx
  on public.units (archived, created_at desc);

create index if not exists units_project_status_created_idx
  on public.units (project_id, status, created_at desc)
  where archived = false;

create index if not exists units_team_created_idx
  on public.units (team_id, created_at desc)
  where archived = false;

create index if not exists units_created_by_created_idx
  on public.units (created_by, created_at desc)
  where archived = false;

create index if not exists units_unit_code_idx
  on public.units (unit_code);

create index if not exists notifications_visibility_created_idx
  on public.notifications (user_id, audience_role, created_at desc);

create index if not exists audit_logs_created_actor_idx
  on public.audit_logs (created_at desc, actor_id, related_unit_id);

create index if not exists analytics_events_dashboard_idx
  on public.analytics_events (team_id, actor_id, project_id, event_type, created_at desc);

create index if not exists analytics_targets_scope_period_idx
  on public.analytics_targets (scope_type, scope_id, starts_at desc);

drop function if exists public.list_units_safe();

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
    select id, role, team_id
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
    case
      when actor.role in ('admin', 'sub_admin') or (actor.role = 'manager' and u.team_id = actor.team_id) or u.created_by = actor.id
      then u.original_owner_name
      else null
    end as original_owner_name,
    case
      when actor.role in ('admin', 'sub_admin') or (actor.role = 'manager' and u.team_id = actor.team_id) or u.created_by = actor.id
      then u.country_code
      else null
    end as country_code,
    case
      when actor.role in ('admin', 'sub_admin') or (actor.role = 'manager' and u.team_id = actor.team_id) or u.created_by = actor.id
      then u.original_owner_phone
      else null
    end as original_owner_phone,
    case
      when actor.role in ('admin', 'sub_admin') or (actor.role = 'manager' and u.team_id = actor.team_id) or u.created_by = actor.id
      then u.normalized_owner_phone
      else null
    end as normalized_owner_phone,
    u.sales_notes,
    u.status,
    u.archived,
    u.created_by,
    creator.full_name as creator_full_name,
    u.team_id,
    u.branch_id,
    u.created_at,
    u.updated_at,
    coalesce(media.items, '[]'::jsonb) as unit_media,
    coalesce(notes.items, '[]'::jsonb) as unit_notes
  from public.units u
  cross join actor
  left join public.lookup_values developer on developer.id = u.developer_id
  left join public.lookup_values project on project.id = u.project_id
  left join public.lookup_values destination on destination.id = u.destination_id
  left join public.lookup_values view_lookup on view_lookup.id = u.view_id
  left join public.profiles creator on creator.id = u.created_by
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'type', m.type,
      'storage_path', m.storage_path,
      'file_name', m.file_name,
      'size_bytes', m.size_bytes
    ) order by m.sort_order, m.created_at) as items
    from public.unit_media m
    where m.unit_id = u.id
  ) media on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', n.id,
      'content', n.content,
      'created_by', n.created_by,
      'created_by_role', n.created_by_role,
      'created_at', n.created_at,
      'creator_full_name', note_creator.full_name
    ) order by n.created_at) as items
    from public.unit_notes n
    left join public.profiles note_creator on note_creator.id = n.created_by
    where n.unit_id = u.id
  ) notes on true
  where
    actor.role in ('admin', 'sub_admin')
    or (actor.role = 'manager' and u.team_id = actor.team_id)
    or (actor.role = 'sales' and u.archived = false)
  order by u.created_at desc
  limit least(greatest(coalesce(limit_count, 500), 1), 500)
  offset greatest(coalesce(offset_count, 0), 0);
$$;

grant execute on function public.list_units_safe(integer, integer) to authenticated;

create or replace function public.list_audit_logs_safe(limit_count integer default 500)
returns table (
  id uuid,
  actor_role public.user_role,
  actor_name text,
  action_type text,
  message_key text,
  message_params jsonb,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  related_unit_code text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select id, role, team_id
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
  select
    log.id,
    log.actor_role,
    coalesce(actor_profile.full_name, 'Inactive Leadra user') as actor_name,
    log.action_type,
    log.message_key,
    log.message_params,
    case
      when log.action_type ilike '%owner%' or log.action_type ilike '%phone%' then null
      else log.previous_value
    end as previous_value,
    case
      when log.action_type ilike '%owner%' or log.action_type ilike '%phone%' then null
      else log.new_value
    end as new_value,
    log.ip_address::text as ip_address,
    unit.unit_code as related_unit_code,
    log.created_at
  from public.audit_logs log
  cross join actor
  left join public.profiles actor_profile on actor_profile.id = log.actor_id
  left join public.units unit on unit.id = log.related_unit_id
  where
    actor.role in ('admin', 'sub_admin')
    or (actor.role = 'manager' and (unit.team_id = actor.team_id or actor_profile.team_id = actor.team_id))
  order by log.created_at desc
  limit least(greatest(coalesce(limit_count, 500), 1), 500);
$$;

grant execute on function public.list_audit_logs_safe(integer) to authenticated;
