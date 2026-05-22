alter table public.units
  drop constraint if exists units_maintenance_fields_match_toggle,
  drop constraint if exists units_maintenance_paid_requires_details;

update public.units
set
  maintenance_cost = null,
  maintenance_due_date = null
where coalesce(maintenance_paid, false);

alter table public.units
  add constraint units_maintenance_fields_match_toggle
  check (
    (coalesce(maintenance_paid, false) and maintenance_cost is null and maintenance_due_date is null)
    or not coalesce(maintenance_paid, false)
  );
