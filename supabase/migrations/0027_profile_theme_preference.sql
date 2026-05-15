alter table public.profiles
  add column if not exists theme_preference text not null default 'light';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('light', 'dark'));

create or replace function public.set_own_theme_preference(theme text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized.';
  end if;

  if theme not in ('light', 'dark') then
    raise exception 'Invalid theme preference.';
  end if;

  update public.profiles
  set theme_preference = theme
  where id = auth.uid()
    and status = 'active'
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_own_theme_preference(text) to authenticated;
