insert into storage.buckets (id, name, public)
values
  ('unit-media', 'unit-media', false),
  ('company-assets', 'company-assets', false)
on conflict (id) do update set public = false;

create policy "Authenticated users can read unit media"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'unit-media');

create policy "Authenticated users can upload unit media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'unit-media');

create policy "Authenticated users can update unit media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'unit-media')
  with check (bucket_id = 'unit-media');

create policy "Authenticated users can delete unit media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'unit-media');

create policy "Authenticated users can read company assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'company-assets');

create policy "Admins can manage company assets"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'company-assets'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'sub_admin')
        and status = 'active'
    )
  )
  with check (
    bucket_id = 'company-assets'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'sub_admin')
        and status = 'active'
    )
  );
