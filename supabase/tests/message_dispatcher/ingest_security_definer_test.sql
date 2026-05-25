-- pgTAP: message_dispatcher_ingest packaging (design §11.1, task 29).

begin;

select plan(3);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_ingest'
  ),
  'ingest is SECURITY DEFINER'
);

select ok(
  (
    select 'search_path=message_dispatcher, public, auth' = any (p.proconfig)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_ingest'
  ),
  'search_path includes message_dispatcher public auth'
);

select ok(
  has_function_privilege(
    'service_role',
    'message_dispatcher.message_dispatcher_ingest(uuid,uuid,message_dispatcher.message_channel,text,jsonb,timestamptz,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_ingest(uuid,uuid,message_dispatcher.message_channel,text,jsonb,timestamptz,text,jsonb)',
    'EXECUTE'
  ),
  'EXECUTE granted to service_role only'
);

select finish();

rollback;
