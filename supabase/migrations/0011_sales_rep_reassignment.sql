alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_active_sales_idx
  on public.profiles (role, status, full_name)
  where deleted_at is null;
