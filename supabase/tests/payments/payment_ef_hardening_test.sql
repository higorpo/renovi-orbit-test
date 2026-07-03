-- pgTAP: payment EF hardening — sandbox token, rate limit, lease revert, reconciliation, tokenize guard.

begin;

select plan(13);

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

-- is_sandbox column
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_gateway_tokens'
      and column_name = 'is_sandbox'
      and is_nullable = 'NO'
      and column_default = 'false'
  ),
  'payment_gateway_tokens.is_sandbox exists with not null default false'
);

-- acquire_or_refresh_netcred_token returns is_sandbox on refresh
select pg_temp.payment_set_service_role();

select is(
  (
    public.acquire_or_refresh_netcred_token(
      'pgtap-sandbox-token',
      now() + interval '1 day',
      true
    )->>'is_sandbox'
  )::boolean,
  true,
  'acquire_or_refresh_netcred_token refreshed payload includes is_sandbox=true'
);

select is(
  (
    public.acquire_or_refresh_netcred_token()->>'is_sandbox'
  )::boolean,
  true,
  'acquire_or_refresh_netcred_token cached payload includes is_sandbox'
);

-- payment_increment_reconciliation_failure
select throws_ok(
  $$ select public.payment_increment_reconciliation_failure(gen_random_uuid()) $$,
  '42501',
  'service_role required for payment_increment_reconciliation_failure',
  'payment_increment_reconciliation_failure rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_increment_reconciliation_failure(gen_random_uuid()) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'payment_increment_reconciliation_failure rejects missing schedule'
);

-- payment_validate_tokenize_checkout_access
select throws_ok(
  $$ select public.payment_validate_tokenize_checkout_access(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  '42501',
  'service_role required for payment_validate_tokenize_checkout_access',
  'payment_validate_tokenize_checkout_access rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_validate_tokenize_checkout_access(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  '42501',
  'FORBIDDEN',
  'payment_validate_tokenize_checkout_access rejects unknown proposal/client pair'
);

-- payment_begin_manual_attempt rate limit
select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
    'clearsale-session'
  ) $$,
  '42501',
  'service_role required for payment_begin_manual_attempt',
  'payment_begin_manual_attempt rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

do $$
declare
  v_client_id uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;
  v_i int;
begin
  for v_i in 1..10 loop
    begin
      perform public.payment_begin_manual_attempt(
        gen_random_uuid(),
        v_client_id,
        'clearsale-session'
      );
    exception
      when others then
        null;
    end;
  end loop;
end;
$$;

select throws_ok(
  $$ select public.payment_begin_manual_attempt(
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
    'clearsale-session'
  ) $$,
  'P0001',
  'RATE_LIMIT_EXCEEDED',
  'payment_begin_manual_attempt enforces manual_charge rate limit at 10 per minute'
);

-- payment_enqueue_notifications CHARGE_IN_ANALYSIS support
select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'CHARGE_IN_ANALYSIS'
  ) $$,
  '42501',
  'service_role required for payment_enqueue_notifications',
  'payment_enqueue_notifications rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'CHARGE_IN_ANALYSIS'
  ) $$,
  'P0002',
  'SCHEDULE_NOT_FOUND',
  'CHARGE_IN_ANALYSIS is accepted before schedule lookup failure'
);

select throws_ok(
  $$ select public.payment_enqueue_notifications(
    gen_random_uuid(),
    'NOT_A_REAL_EVENT'
  ) $$,
  '22023',
  'UNSUPPORTED_NOTIFICATION_EVENT',
  'payment_enqueue_notifications still rejects unsupported events'
);

-- SECURITY DEFINER on new RPCs
select ok(
  (
    select bool_and(p.prosecdef)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'payment_increment_reconciliation_failure',
        'payment_validate_tokenize_checkout_access'
      )
  ),
  'new payment hardening RPCs are SECURITY DEFINER'
);

select finish();

rollback;
