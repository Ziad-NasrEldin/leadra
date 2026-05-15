alter table public.lookup_values
  add column if not exists thumbnail_path text;
