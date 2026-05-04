create or replace function public.safe_user_role(value text)
returns public.user_role
language sql
immutable
as $$
  select case
    when value in ('admin', 'sub_admin', 'manager', 'sales') then value::public.user_role
    else 'sales'::public.user_role
  end;
$$;

create or replace function public.safe_uuid(value text)
returns uuid
language sql
immutable
as $$
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then value::uuid
    else null
  end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    job_title,
    phone_number,
    team_id,
    branch_id,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'leadra-user'), '@', 1)),
    coalesce(new.email, new.id::text || '@leadra.local'),
    public.safe_user_role(new.raw_user_meta_data ->> 'role'),
    coalesce(new.raw_user_meta_data ->> 'job_title', 'Team member'),
    coalesce(new.raw_user_meta_data ->> 'phone_number', '+200000000000'),
    public.safe_uuid(new.raw_user_meta_data ->> 'team_id'),
    public.safe_uuid(new.raw_user_meta_data ->> 'branch_id'),
    'active'
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.mark_own_login()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set last_login_at = now()
  where id = auth.uid()
    and status = 'active';
$$;

grant execute on function public.mark_own_login() to authenticated;

insert into public.branches (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'Cairo Branch')
on conflict (name) do nothing;

insert into public.teams (id, name, branch_id)
values
  ('22222222-2222-4222-8222-222222222222', 'Prime Team', '11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333', 'Elite Team', '11111111-1111-4111-8111-111111111111')
on conflict (name) do nothing;

insert into public.lookup_values (id, kind, label)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', 'developer', 'Palm Hills'),
  ('aaaaaaaa-0002-4000-8000-000000000002', 'developer', 'SODIC'),
  ('aaaaaaaa-0003-4000-8000-000000000003', 'project', 'New Cairo Estates'),
  ('aaaaaaaa-0004-4000-8000-000000000004', 'project', 'ZED East'),
  ('aaaaaaaa-0005-4000-8000-000000000005', 'destination', 'New Cairo'),
  ('aaaaaaaa-0006-4000-8000-000000000006', 'destination', 'Sheikh Zayed'),
  ('aaaaaaaa-0007-4000-8000-000000000007', 'view', 'Garden'),
  ('aaaaaaaa-0008-4000-8000-000000000008', 'view', 'Lagoon'),
  ('aaaaaaaa-0009-4000-8000-000000000009', 'unit_type', 'Apartment'),
  ('aaaaaaaa-0010-4000-8000-000000000010', 'unit_type', 'Villa'),
  ('aaaaaaaa-0011-4000-8000-000000000011', 'finish', 'Fully Finished'),
  ('aaaaaaaa-0012-4000-8000-000000000012', 'finish', 'Core and Shell')
on conflict (kind, label) do nothing;
