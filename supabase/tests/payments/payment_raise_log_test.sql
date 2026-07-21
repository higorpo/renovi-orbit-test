-- pgTAP: payment Task 83 — structured RPC logging helpers (design.md §10.2).

begin;

select plan(7);

select has_function(
  'public',
  'payment_raise_log',
  array['text', 'uuid', 'uuid', 'jsonb'],
  'payment_raise_log helper exists'
);

select has_function(
  'public',
  'payment_build_log_payload',
  array['text', 'uuid', 'uuid', 'jsonb'],
  'payment_build_log_payload helper exists'
);

select is(
  public.payment_build_log_payload(
    'charge_attempt_started',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    jsonb_build_object(
      'gateway_slug', 'netcred',
      'attempt_number', 1,
      'initiator', 'cron'
    )
  ),
  jsonb_build_object(
    'domain', 'payment',
    'event', 'charge_attempt_started',
    'service_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'schedule_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'gateway_slug', 'netcred',
    'attempt_number', 1,
    'initiator', 'cron'
  ),
  'payment_build_log_payload merges correlation IDs and context'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_raise_log'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_claim_charge_batch'
  ),
  'payment_claim_charge_batch emits structured logs'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'payment_raise_log'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_commit_charge_outcome'
  ),
  'payment_commit_charge_outcome emits structured logs'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'gateway_reference_code'
      and pg_get_functiondef(p.oid) ~ 'gateway_charge_id'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_commit_charge_outcome'
  ),
  'payment_commit_charge_outcome raise_log includes gateway_reference_code and gateway_charge_id'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.payment_raise_log(text, uuid, uuid, jsonb)',
    'EXECUTE'
  ),
  'payment_raise_log is internal-only (not callable by service_role directly)'
);

select * from finish();
rollback;
