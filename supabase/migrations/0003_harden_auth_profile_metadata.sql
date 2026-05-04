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
