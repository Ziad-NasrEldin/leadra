revoke delete, truncate, references, trigger on public.units from authenticated;
grant select, insert, update on public.units to authenticated;
grant usage, select on sequence public.units_id_seq to authenticated;
