do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.list_units_safe(integer, integer)'::regprocedure)
  into function_definition;

  execute replace(
    function_definition,
    'case when m.storage_path like ''data:%'' then '''' else m.storage_path end',
    'm.storage_path'
  );

  select pg_get_functiondef('public.search_units_safe(jsonb, integer, integer)'::regprocedure)
  into function_definition;

  execute replace(
    function_definition,
    'case when m.storage_path like ''data:%'' then '''' else m.storage_path end',
    'm.storage_path'
  );
end $$;

grant execute on function public.list_units_safe(integer, integer) to authenticated;
grant execute on function public.search_units_safe(jsonb, integer, integer) to authenticated;

notify pgrst, 'reload schema';
