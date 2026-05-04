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
    public.safe_user_role(new.raw_app_meta_data ->> 'role'),
    coalesce(new.raw_user_meta_data ->> 'job_title', 'Team member'),
    coalesce(new.raw_user_meta_data ->> 'phone_number', '+200000000000'),
    public.safe_uuid(new.raw_app_meta_data ->> 'team_id'),
    public.safe_uuid(new.raw_app_meta_data ->> 'branch_id'),
    'active'
  )
  on conflict (id) do update set
    role = excluded.role,
    team_id = excluded.team_id,
    branch_id = excluded.branch_id;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
