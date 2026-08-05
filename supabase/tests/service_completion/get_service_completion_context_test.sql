-- pgTAP: service-completion Task 45 — get_service_completion_context exists + grants.
-- Full exposure matrix (client/provider full detail vs marketplace limited): Task 60.
-- Limited marketplace viewers get status/ready only (no checklist_schema) via the RPC.

begin;

select plan(4);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_service_completion_context'
      and pg_get_function_identity_arguments(p.oid) in ('uuid', 'p_service_request_id uuid')
  ),
  'get_service_completion_context(uuid) exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_service_completion_context(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute get_service_completion_context'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_service_completion_context(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute get_service_completion_context'
);

select throws_ok(
  $$ select public.get_service_completion_context(gen_random_uuid()) $$,
  '42501',
  'Authentication required for get_service_completion_context',
  'unauthenticated call fails closed'
);

select * from finish();
rollback;
