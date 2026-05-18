do $$
declare
  duplicate_owner_name_constraint record;
  duplicate_owner_name_index record;
begin
  for duplicate_owner_name_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.units'::regclass
      and con.contype in ('u', 'x')
      and pg_get_constraintdef(con.oid) ilike '%original_owner_name%'
  loop
    execute format('alter table public.units drop constraint if exists %I', duplicate_owner_name_constraint.conname);
  end loop;

  for duplicate_owner_name_index in
    select idx.relname
    from pg_index ind
    join pg_class idx on idx.oid = ind.indexrelid
    where ind.indrelid = 'public.units'::regclass
      and ind.indisunique
      and not exists (
        select 1
        from pg_constraint con
        where con.conindid = ind.indexrelid
      )
      and pg_get_indexdef(ind.indexrelid) ilike '%original_owner_name%'
  loop
    execute format('drop index if exists public.%I', duplicate_owner_name_index.relname);
  end loop;
end $$;
