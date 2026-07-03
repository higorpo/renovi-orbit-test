-- pgTAP: payment Task 108 — payment_confirm_service_completed client completion.

begin;

select plan(5);

create or replace function pg_temp.payment_set_client_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.payment_seed_executed_service_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_client_id uuid,
  p_is_disputed boolean default false
)
returns void
language plpgsql
as $$
declare
  v_pricing record;
  v_slot jsonb;
begin
  select p.*
  into v_pricing
  from public.provider_proposals p
  limit 1;

  v_slot := coalesce(
    v_pricing.proposed_slots->0,
    jsonb_build_object('date', current_date::text, 'start_time', '09:00', 'end_time', '10:00')
  );

  insert into public.contracted_services (
    id,
    service_request_id,
    proposal_id,
    client_id,
    provider_id,
    status,
    scheduled_start_date,
    scheduled_slot,
    executed_at
  )
  select
    p_contracted_service_id,
    v_pricing.service_request_id,
    v_pricing.id,
    p_client_id,
    p_provider_id,
    'EXECUTED'::public.contracted_service_status,
    current_date,
    v_slot,
    now() - interval '2 hours'
  from public.provider_proposals p
  where p.id = v_pricing.id;

  insert into public.payment_schedules (
    contracted_service_id,
    client_id,
    provider_id,
    gateway_slug,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    idempotency_key,
    paid_at,
    is_disputed
  )
  values (
    p_contracted_service_id,
    p_client_id,
    p_provider_id,
    'netcred',
    1,
    100.00,
    10.00,
    90.00,
    now() - interval '24 hours',
    'PAID'::public.payment_schedule_state,
    p_contracted_service_id::text,
    now() - interval '24 hours',
    p_is_disputed
  );
end;
$$;

select throws_ok(
  $$ select public.payment_confirm_service_completed(gen_random_uuid()) $$,
  '42501',
  'Authentication required for payment_confirm_service_completed',
  'rejects unauthenticated callers'
);

do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_confirmed_id uuid := gen_random_uuid();
  v_disputed_id uuid := gen_random_uuid();
  v_ok_id uuid := gen_random_uuid();
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  limit 1;

  perform pg_temp.payment_seed_executed_service_fixture(
    v_confirmed_id,
    v_provider_id,
    v_client_id,
    false
  );

  update public.contracted_services
  set status = 'CONFIRMED'::public.contracted_service_status,
      executed_at = null
  where id = v_confirmed_id;

  perform pg_temp.payment_seed_executed_service_fixture(
    v_disputed_id,
    v_provider_id,
    v_client_id,
    true
  );

  perform pg_temp.payment_seed_executed_service_fixture(
    v_ok_id,
    v_provider_id,
    v_client_id,
    false
  );

  perform pg_temp.payment_set_client_auth(v_client_id);

  perform set_config('test.confirm.confirmed', v_confirmed_id::text, true);
  perform set_config('test.confirm.disputed', v_disputed_id::text, true);
  perform set_config('test.confirm.ok', v_ok_id::text, true);
end;
$seed$;

select throws_ok(
  $$ select public.payment_confirm_service_completed(
    current_setting('test.confirm.confirmed')::uuid
  ) $$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'non-EXECUTED status raises INVALID_STATUS_TRANSITION'
);

select is(
  public.payment_confirm_service_completed(
    current_setting('test.confirm.ok')::uuid
  )->>'status',
  'COMPLETED',
  'EXECUTED service confirms to COMPLETED'
);

select is(
  public.payment_confirm_service_completed(
    current_setting('test.confirm.disputed')::uuid
  )->>'status',
  'COMPLETED',
  'is_disputed does not block client completion (Req 32 AC4)'
);

select is(
  (
    select cs.completed_by
    from public.contracted_services cs
    where cs.id = current_setting('test.confirm.ok')::uuid
  ),
  'client',
  'completed_by is client'
);

select * from finish();
rollback;
