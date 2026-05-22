alter table public.units
  drop constraint if exists units_maintenance_paid_requires_details,
  drop constraint if exists units_maintenance_fields_match_toggle;

alter table public.units
  add constraint units_maintenance_fields_match_toggle
  check (
    (maintenance_paid and maintenance_cost is not null and maintenance_due_date is not null)
    or (not maintenance_paid and maintenance_due_date is null)
  );
