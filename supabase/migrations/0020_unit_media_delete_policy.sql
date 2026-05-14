drop policy if exists "unit media delete by unit editors" on public.unit_media;

create policy "unit media delete by unit editors" on public.unit_media
for delete using (
  exists (
    select 1
    from public.units u
    where u.id = unit_id
      and (
        public.current_role() in ('admin', 'sub_admin')
        or (public.current_role() = 'manager' and u.team_id = public.current_team_id())
        or (public.current_role() = 'sales' and u.created_by = auth.uid() and u.archived = false)
      )
  )
);
