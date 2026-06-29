-- pgTAP: payment_update_webhook_event_state RPC (webhook EF hardening).

begin;

select plan(10);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select throws_ok(
  $$ select public.payment_update_webhook_event_state(
    gen_random_uuid(),
    'FAILED'::public.payment_webhook_event_state,
    'INVALID_SIGNATURE'
  ) $$,
  '42501',
  'service_role required for payment_update_webhook_event_state',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_CAPTURE',
  'evt-state-1',
  '{"id":"evt-state-1"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
);

select is(
  (
    public.payment_update_webhook_event_state(
      (
        select id
        from public.payment_webhook_events
        where gateway_event_id = 'evt-state-1'
      ),
      'VALIDATING'::public.payment_webhook_event_state
    )->>'state'
  ),
  'VALIDATING',
  'RECEIVED to VALIDATING transition succeeds'
);

select is(
  (
    select state::text
    from public.payment_webhook_events
    where gateway_event_id = 'evt-state-1'
  ),
  'VALIDATING',
  'event row reflects VALIDATING state'
);

select throws_ok(
  $$ select public.payment_update_webhook_event_state(
    (
      select id
      from public.payment_webhook_events
      where gateway_event_id = 'evt-state-1'
    ),
    'FAILED'::public.payment_webhook_event_state
  ) $$,
  '22023',
  'p_failure_reason is required for FAILED state',
  'FAILED transition requires failure reason'
);

select is(
  (
    public.payment_update_webhook_event_state(
      (
        select id
        from public.payment_webhook_events
        where gateway_event_id = 'evt-state-1'
      ),
      'FAILED'::public.payment_webhook_event_state,
      'INVALID_SIGNATURE'
    )->>'state'
  ),
  'FAILED',
  'VALIDATING to FAILED transition succeeds'
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_CAPTURE',
  'evt-state-dup',
  '{"id":"evt-state-dup"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
);

select public.payment_ingest_webhook_event(
  'netcred'::public.payment_gateway_slug,
  'TRANSACTION_CAPTURE',
  'evt-state-dup',
  '{"id":"evt-state-dup"}'::jsonb,
  '{"X-NETCRED-Event":"TRANSACTION_CAPTURE"}'::jsonb
);

select is(
  (
    public.payment_update_webhook_event_state(
      (
        select id
        from public.payment_webhook_events
        where gateway_event_id = 'evt-state-dup'
      ),
      'DUPLICATE'::public.payment_webhook_event_state
    )->>'state'
  ),
  'DUPLICATE',
  'duplicate finalize sets DUPLICATE state'
);

select isnt(
  (
    select processed_at
    from public.payment_webhook_events
    where gateway_event_id = 'evt-state-dup'
  ),
  null,
  'duplicate finalize sets processed_at'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_update_webhook_event_state'
      and p.prosecdef
  ),
  'payment_update_webhook_event_state is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.payment_update_webhook_event_state(uuid, public.payment_webhook_event_state, text)',
    'EXECUTE'
  ),
  'service_role can execute payment_update_webhook_event_state'
);

select * from finish();

rollback;
