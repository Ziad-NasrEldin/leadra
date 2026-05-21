alter table public.units
  add column if not exists is_special boolean not null default false,
  add column if not exists special_marked_at timestamptz,
  add column if not exists special_marked_by uuid;

do $$
begin
  if to_regclass('public.profiles') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.units'::regclass
        and conname = 'units_special_marked_by_fkey'
    )
  then
    alter table public.units
      add constraint units_special_marked_by_fkey
      foreign key (special_marked_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists units_special_active_idx
  on public.units (is_special, created_at desc)
  where archived = false and is_special = true;

create or replace function public.enforce_unit_special_permissions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
begin
  if coalesce(actor_role::text, '') not in ('admin', 'sub_admin')
    and (
      old.is_special is distinct from new.is_special
      or old.special_marked_at is distinct from new.special_marked_at
      or old.special_marked_by is distinct from new.special_marked_by
    )
  then
    raise exception 'Only admins can manage special units.';
  end if;

  return new;
end;
$$;

drop trigger if exists units_enforce_unit_special_permissions on public.units;
create trigger units_enforce_unit_special_permissions
before update of is_special, special_marked_at, special_marked_by on public.units
for each row execute function public.enforce_unit_special_permissions();

drop function if exists public.set_unit_special(bigint, boolean);

create function public.set_unit_special(target_unit_id bigint, mark_special boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_role();
begin
  if coalesce(actor_role::text, '') not in ('admin', 'sub_admin') then
    raise exception 'Only admins can manage special units.';
  end if;

  update public.units
  set
    is_special = mark_special,
    special_marked_at = case when mark_special then now() else null end,
    special_marked_by = case when mark_special then auth.uid() else null end,
    updated_at = now()
  where id = target_unit_id;

  if not found then
    raise exception 'Unit not found.';
  end if;
end;
$$;

revoke all on function public.set_unit_special(bigint, boolean) from public;
grant execute on function public.set_unit_special(bigint, boolean) to authenticated;

revoke all on function public.enforce_unit_special_permissions() from public;

notify pgrst, 'reload schema';
