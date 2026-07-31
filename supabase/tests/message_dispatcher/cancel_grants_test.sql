-- pgTAP: cancel RPC grants and SECURITY DEFINER (design §5.2, task 32).

begin;

select plan(4);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_cancel'
  ),
  'cancel is SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'message_dispatcher.message_dispatcher_cancel(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE cancel (service_role only)'
);

select ok(
  has_function_privilege(
    'service_role',
    'message_dispatcher.message_dispatcher_cancel(uuid,text)',
    'EXECUTE'
  ),
  'service_role can EXECUTE cancel'
);

select ok(
  not has_function_privilege(
    'anon',
    'message_dispatcher.message_dispatcher_cancel(uuid,text)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE cancel'
);

select finish();

rollback;
