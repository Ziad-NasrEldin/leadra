create or replace function public.analytics_dashboard(filters jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with current_user_profile as (
  select id, role, team_id
  from public.profiles
  where id = auth.uid() and status = 'active'
),
range_input as (
  select
    coalesce(filters->>'dateWindow', 'live') as date_window,
    nullif(filters->>'startDate', '')::date as custom_start,
    nullif(filters->>'endDate', '')::date as custom_end
),
date_range as (
  select
    case
      when date_window = 'custom' and custom_start is not null then custom_start::timestamptz
      when date_window = '30d' then now() - interval '29 days'
      when date_window = '90d' then now() - interval '89 days'
      else now() - interval '6 days'
    end as starts_at,
    case
      when date_window = 'custom' and custom_end is not null then (custom_end + 1)::timestamptz - interval '1 millisecond'
      else now()
    end as ends_at
  from range_input
),
team_filter as (select value::uuid as id from jsonb_array_elements_text(coalesce(filters->'teamIds', '[]'::jsonb))),
user_filter as (select value::uuid as id from jsonb_array_elements_text(coalesce(filters->'userIds', '[]'::jsonb))),
project_filter as (select value::uuid as id from jsonb_array_elements_text(coalesce(filters->'projectIds', '[]'::jsonb))),
developer_filter as (select value::uuid as id from jsonb_array_elements_text(coalesce(filters->'developerIds', '[]'::jsonb))),
destination_filter as (select value::uuid as id from jsonb_array_elements_text(coalesce(filters->'destinationIds', '[]'::jsonb))),
status_filter as (select value::public.unit_status as value from jsonb_array_elements_text(coalesce(filters->'statuses', '[]'::jsonb))),
payment_filter as (select value::public.payment_method as value from jsonb_array_elements_text(coalesce(filters->'paymentMethods', '[]'::jsonb))),
scoped_users as (
  select p.*
  from public.profiles p
  cross join current_user_profile actor
  where actor.role in ('admin', 'sub_admin', 'manager')
    and (not exists (select 1 from team_filter) or p.team_id in (select id from team_filter))
    and (not exists (select 1 from user_filter) or p.id in (select id from user_filter))
),
scoped_units as (
  select u.*
  from public.units u
  cross join current_user_profile actor
  where actor.role in ('admin', 'sub_admin', 'manager')
    and (not exists (select 1 from team_filter) or u.team_id in (select id from team_filter))
    and (not exists (select 1 from user_filter) or u.created_by in (select id from user_filter))
    and (not exists (select 1 from project_filter) or u.project_id in (select id from project_filter))
    and (not exists (select 1 from developer_filter) or u.developer_id in (select id from developer_filter))
    and (not exists (select 1 from destination_filter) or u.destination_id in (select id from destination_filter))
    and (not exists (select 1 from status_filter) or u.status in (select value from status_filter))
    and (not exists (select 1 from payment_filter) or u.payment_method in (select value from payment_filter))
),
scoped_events as (
  select e.*
  from public.analytics_events e
  cross join current_user_profile actor
  cross join date_range r
  where actor.role in ('admin', 'sub_admin', 'manager')
    and e.created_at between r.starts_at and r.ends_at
    and (not exists (select 1 from team_filter) or e.team_id in (select id from team_filter))
    and (not exists (select 1 from user_filter) or e.actor_id in (select id from user_filter))
    and (
      e.unit_id is null
      or e.unit_id in (select id from scoped_units)
    )
    and (not exists (select 1 from project_filter) or e.project_id in (select id from project_filter) or e.unit_id in (select id from scoped_units))
    and (not exists (select 1 from developer_filter) or e.developer_id in (select id from developer_filter) or e.unit_id in (select id from scoped_units))
    and (not exists (select 1 from destination_filter) or e.destination_id in (select id from destination_filter) or e.unit_id in (select id from scoped_units))
),
timeline as (
  select
    day::date as date,
    count(e.id) filter (where e.event_type = 'unit_created') as units_created,
    count(e.id) filter (where e.event_type = 'status_changed') as status_changes,
    coalesce(sum(e.amount_value) filter (where e.event_type = 'status_changed' and e.unit_status_after in ('sold', 'sold_by_us', 'sold_by_others')), 0) as sold_value,
    count(e.id) filter (where e.event_type in ('pdf_generated', 'pdf_shared_or_downloaded')) as pdf_exports,
    count(e.id) as activity_count
  from date_range r
  cross join generate_series(date_trunc('day', r.starts_at), date_trunc('day', r.ends_at), interval '1 day') day
  left join scoped_events e on e.created_at::date = day::date
  group by day::date
  order by day::date
),
overview as (
  select jsonb_build_object(
    'totalActiveUnits', count(*) filter (where u.archived = false),
    'availableUnits', count(*) filter (where u.archived = false and u.status = 'available'),
    'holdUnits', count(*) filter (where u.archived = false and u.status = 'hold'),
    'soldUnits', count(*) filter (where u.archived = false and u.status in ('sold', 'sold_by_us', 'sold_by_others')),
    'soldValue', coalesce(sum(u.total_amount) filter (where u.status in ('sold', 'sold_by_us', 'sold_by_others')), 0),
    'projectedCommission', coalesce(sum(u.commission_amount) filter (where u.archived = false), 0),
    'activeUsers', (select count(*) from scoped_users where status = 'active'),
    'duplicateAttempts', (select count(*) from scoped_events where event_type = 'duplicate_phone_blocked'),
    'pdfExports', (select count(*) from scoped_events where event_type in ('pdf_generated', 'pdf_shared_or_downloaded')),
    'inactiveUsers', (select count(*) from scoped_users where status = 'inactive'),
    'archivedUnits', count(*) filter (where u.archived = true),
    'staleUnits', count(*) filter (where u.archived = false and u.status not in ('sold', 'sold_by_us', 'sold_by_others') and u.updated_at < now() - interval '72 hours')
  ) as value
  from scoped_units u
),
sales_performance as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.id,
    'userName', p.full_name,
    'teamId', p.team_id,
    'unitsCreated', coalesce(s.units_created, 0),
    'unitsSold', coalesce(s.units_sold, 0),
    'soldValue', coalesce(s.sold_value, 0),
    'commissionContribution', coalesce(s.commission_contribution, 0),
    'activityCount', coalesce(a.activity_count, 0),
    'lastActivityAt', a.last_activity_at
  ) order by coalesce(a.activity_count, 0) desc, coalesce(s.sold_value, 0) desc), '[]'::jsonb) as value
  from scoped_users p
  left join lateral (
    select
      count(*) as units_created,
      count(*) filter (where status in ('sold', 'sold_by_us', 'sold_by_others')) as units_sold,
      coalesce(sum(total_amount) filter (where status in ('sold', 'sold_by_us', 'sold_by_others')), 0) as sold_value,
      coalesce(sum(commission_amount) filter (where status in ('sold', 'sold_by_us', 'sold_by_others')), 0) as commission_contribution
    from scoped_units u
    where u.created_by = p.id
  ) s on true
  left join lateral (
    select count(*) as activity_count, max(created_at) as last_activity_at
    from scoped_events e
    where e.actor_id = p.id
  ) a on true
  where p.role = 'sales' and (coalesce(s.units_created, 0) > 0 or coalesce(a.activity_count, 0) > 0)
),
inventory_health as (
  select coalesce(jsonb_agg(item order by (item->>'totalUnits')::int desc, item->>'projectName'), '[]'::jsonb) as value
  from (
    select jsonb_build_object(
      'projectId', u.project_id,
      'projectName', coalesce(project.label, 'Unknown project'),
      'developerName', coalesce(dev.label, 'Unknown developer'),
      'destinationName', coalesce(dest.label, 'Unknown destination'),
      'totalUnits', count(*),
      'availableUnits', count(*) filter (where u.status = 'available'),
      'holdUnits', count(*) filter (where u.status = 'hold'),
      'soldUnits', count(*) filter (where u.status in ('sold', 'sold_by_us', 'sold_by_others')),
      'holdRatio', round((count(*) filter (where u.status = 'hold')::numeric / nullif(count(*), 0)) * 100),
      'averagePrice', round(avg(u.total_amount)),
      'mediaCompleteness', round((count(distinct m.unit_id)::numeric / nullif(count(distinct u.id), 0)) * 100),
      'staleUnits', count(*) filter (where u.status not in ('sold', 'sold_by_us', 'sold_by_others') and u.updated_at < now() - interval '72 hours')
    ) as item
    from scoped_units u
    left join public.lookup_values project on project.id = u.project_id
    left join public.lookup_values dev on dev.id = u.developer_id
    left join public.lookup_values dest on dest.id = u.destination_id
    left join public.unit_media m on m.unit_id = u.id
    where u.archived = false
    group by u.project_id, project.label, dev.label, dest.label
  ) rows
),
target_progress as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetId', t.id,
    'label', coalesce(t.scope_id::text, 'company') || ' ' || t.period || ' target',
    'unitsCreatedProgress', least(100, case when t.target_units_created <= 0 then 0 else round((actual.units_created::numeric / t.target_units_created) * 100) end),
    'unitsSoldProgress', least(100, case when t.target_units_sold <= 0 then 0 else round((actual.units_sold::numeric / t.target_units_sold) * 100) end),
    'soldValueProgress', least(100, case when t.target_sold_value <= 0 then 0 else round((actual.sold_value / t.target_sold_value) * 100) end),
    'commissionProgress', least(100, case when t.target_commission <= 0 then 0 else round((actual.commission / t.target_commission) * 100) end),
    'activityProgress', least(100, case when t.target_activity_events <= 0 then 0 else round((actual.activity_count::numeric / t.target_activity_events) * 100) end)
  ) order by t.starts_at desc), '[]'::jsonb) as value
  from public.analytics_targets t
  cross join current_user_profile actor
  left join lateral (
    select
      count(distinct u.id) filter (where u.created_at between t.starts_at and t.ends_at) as units_created,
      count(distinct u.id) filter (where u.status in ('sold', 'sold_by_us', 'sold_by_others') and u.updated_at between t.starts_at and t.ends_at) as units_sold,
      coalesce(sum(u.total_amount) filter (where u.status in ('sold', 'sold_by_us', 'sold_by_others') and u.updated_at between t.starts_at and t.ends_at), 0) as sold_value,
      coalesce(sum(u.commission_amount) filter (where u.status in ('sold', 'sold_by_us', 'sold_by_others') and u.updated_at between t.starts_at and t.ends_at), 0) as commission,
      count(distinct e.id) filter (where e.created_at between t.starts_at and t.ends_at) as activity_count
    from scoped_units u
    left join scoped_events e on e.unit_id = u.id or e.actor_id = u.created_by
    where t.scope_type = 'company'
      or (t.scope_type = 'team' and u.team_id = t.scope_id)
      or (t.scope_type = 'user' and u.created_by = t.scope_id)
  ) actual on true
  where actor.role in ('admin', 'sub_admin', 'manager')
),
filter_options as (
  select jsonb_build_object(
    'teams', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', team_id, 'label', team_id::text)), '[]'::jsonb) from scoped_users where team_id is not null),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', full_name) order by full_name), '[]'::jsonb) from scoped_users where role in ('sales', 'manager')),
    'projects', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', u.project_id, 'label', coalesce(l.label, 'Unknown project'))), '[]'::jsonb) from scoped_units u left join public.lookup_values l on l.id = u.project_id),
    'developers', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', u.developer_id, 'label', coalesce(l.label, 'Unknown developer'))), '[]'::jsonb) from scoped_units u left join public.lookup_values l on l.id = u.developer_id),
    'destinations', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', u.destination_id, 'label', coalesce(l.label, 'Unknown destination'))), '[]'::jsonb) from scoped_units u left join public.lookup_values l on l.id = u.destination_id)
  ) as value
)
select case
  when not exists (select 1 from current_user_profile where role in ('admin', 'sub_admin', 'manager')) then
    jsonb_build_object('error', 'analytics_not_allowed')
  else jsonb_build_object(
    'scopeLabel', 'Company-wide',
    'overview', (select value from overview),
    'salesPerformance', (select value from sales_performance),
    'inventoryHealth', (select value from inventory_health),
    'activityTimeline', (select coalesce(jsonb_agg(jsonb_build_object(
      'date', date,
      'unitsCreated', units_created,
      'statusChanges', status_changes,
      'soldValue', sold_value,
      'pdfExports', pdf_exports,
      'activityCount', activity_count
    ) order by date), '[]'::jsonb) from timeline),
    'soldValueTrend', (select coalesce(jsonb_agg(jsonb_build_object('date', date, 'label', to_char(date, 'MM/DD'), 'value', sold_value) order by date), '[]'::jsonb) from timeline),
    'pdfExportTrend', (select coalesce(jsonb_agg(jsonb_build_object('date', date, 'label', to_char(date, 'MM/DD'), 'value', pdf_exports) order by date), '[]'::jsonb) from timeline),
    'targetProgress', (select value from target_progress),
    'filterOptions', (select value from filter_options)
  )
end;
$$;

grant execute on function public.analytics_dashboard(jsonb) to authenticated;
