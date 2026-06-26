-- pgTAP: payment Task 49 — payment_reset_dead_letter_event operator recovery.

begin;

select plan(6);

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
  $$ select public.payment_reset_dead_letter_event(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_reset_dead_letter_event',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_event_id uuid := gen_random_uuid();
  v_queue_id uuid := gen_random_uuid();
begin
  insert into public.payment_webhook_events (
    id,
    gateway_slug,
    event_type,
    gateway_event_id,
    raw_payload,
    raw_headers,
    state,
    retry_count,
    failure_reason
  )
  values (
    v_event_id,
    'netcred',
    'TRANSACTION_CAPTURE',
    'prov-evt-dead-letter-1',
    jsonb_build_object(
      'transaction', jsonb_build_object(
        'referenceCode', '00000000-0000-4000-8000-000000000001'
      )
    ),
    '{}'::jsonb,
    'DEAD_LETTER'::public.payment_webhook_event_state,
    3,
    'handler timeout'
  );

  insert into public.payment_webhook_processing_queue (
    id,
    webhook_event_id,
    gateway_slug,
    event_type,
    state,
    attempt_count,
    failure_reason
  )
  values (
    v_queue_id,
    v_event_id,
    'netcred',
    'TRANSACTION_CAPTURE',
    'FAILED'::public.payment_webhook_queue_state,
    3,
    'handler timeout'
  );

  perform set_config('test.dead_letter.event_id', v_event_id::text, true);
end;
$seed$;

select throws_ok(
  $$ select public.payment_reset_dead_letter_event(gen_random_uuid()) $$,
  'P0001',
  'EVENT_NOT_FOUND_OR_NOT_DEAD_LETTER',
  'rejects missing or non-dead-letter event ids'
);

select ok(
  (
    select public.payment_reset_dead_letter_event(
      current_setting('test.dead_letter.event_id')::uuid
    ) is not null
  ),
  'payment_reset_dead_letter_event returns payload for dead-letter row'
);

select is(
  (
    select e.state::text
    from public.payment_webhook_events e
    where e.id = current_setting('test.dead_letter.event_id')::uuid
  ),
  'RECEIVED',
  'dead-letter event moves to RECEIVED with retry_count reset'
);

select is(
  (
    select e.retry_count
    from public.payment_webhook_events e
    where e.id = current_setting('test.dead_letter.event_id')::uuid
  ),
  0::smallint,
  'retry_count reset to zero'
);

select is(
  (
    select q.state::text
    from public.payment_webhook_processing_queue q
    where q.webhook_event_id = current_setting('test.dead_letter.event_id')::uuid
  ),
  'PENDING',
  'queue row reset to PENDING for retry cron pickup'
);

select * from finish();
rollback;
