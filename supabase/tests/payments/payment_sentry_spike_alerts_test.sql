-- pgTAP: FIX-011 / CHK-026 — 15m webhook auth fail + FAILED_PERMANENT spike alerts.

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

select ok(
  to_regclass('public.payment_alert_webhook_auth_fail_spike_v') is not null,
  'payment_alert_webhook_auth_fail_spike_v exists'
);

select ok(
  to_regclass('public.payment_alert_failed_permanent_spike_v') is not null,
  'payment_alert_failed_permanent_spike_v exists'
);

select has_function(
  'public',
  'payment_evaluate_sentry_spike_alerts',
  array[]::text[],
  'payment_evaluate_sentry_spike_alerts exists'
);

select has_function(
  'public',
  'payment_cron_emit_sentry_spike_alerts',
  array[]::text[],
  'payment_cron_emit_sentry_spike_alerts exists'
);

select pg_temp.payment_set_service_role();

select lives_ok(
  $$ select public.payment_evaluate_sentry_spike_alerts() $$,
  'evaluate spike alerts runs without error'
);

select is(
  public.payment_evaluate_sentry_spike_alerts(),
  '[]'::jsonb,
  'spike evaluator returns empty array when under threshold'
);

-- Seed synthetic INVALID_SIGNATURE burst above default threshold (10).
do $seed_auth$
begin
  insert into public.payment_webhook_events (
    gateway_slug,
    event_type,
    gateway_event_id,
    raw_payload,
    raw_headers,
    state,
    failure_reason,
    signature_validated,
    created_at
  )
  select
    'netcred'::public.payment_gateway_slug,
    'TRANSACTION_UPDATE',
    'spike-auth-' || g::text,
    '{}'::jsonb,
    '{}'::jsonb,
    'FAILED'::public.payment_webhook_event_state,
    'INVALID_SIGNATURE',
    false,
    now() - interval '1 minute'
  from generate_series(1, 11) as g;
end;
$seed_auth$;

select ok(
  (
    select auth_fail_15m > 10
    from public.payment_alert_webhook_auth_fail_spike_v
  ),
  'webhook auth fail spike view counts INVALID_SIGNATURE in 15m window'
);

select ok(
  (
    select public.payment_evaluate_sentry_spike_alerts() @>
      jsonb_build_array(
        jsonb_build_object('kind', 'webhook_auth_fail_spike')
      )
  ),
  'evaluate emits webhook_auth_fail_spike when threshold breached'
);

-- Seed FAILED_PERMANENT audit burst above default threshold (5).
do $seed_fp$
declare
  v_i int;
begin
  for v_i in 1..6 loop
    insert into public.payment_audit_log (
      event_type,
      entity_type,
      entity_id,
      to_state,
      actor,
      created_at
    )
    values (
      'CHARGE_FAILED_PERMANENT',
      'payment_schedule',
      gen_random_uuid(),
      'FAILED_PERMANENT',
      'cron'::public.payment_audit_actor,
      now() - interval '2 minutes'
    );
  end loop;
end;
$seed_fp$;

select ok(
  (
    select failed_permanent_15m > 5
    from public.payment_alert_failed_permanent_spike_v
  ),
  'failed permanent spike view counts CHARGE_FAILED_PERMANENT in 15m window'
);

select ok(
  (
    select public.payment_evaluate_sentry_spike_alerts() @>
      jsonb_build_array(
        jsonb_build_object('kind', 'failed_permanent_spike')
      )
  ),
  'evaluate emits failed_permanent_spike when threshold breached'
);

select * from finish();

rollback;
