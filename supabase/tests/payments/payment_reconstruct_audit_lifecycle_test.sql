-- pgTAP: payment Task 50 — payment_reconstruct_audit_lifecycle chronological timeline.

begin;

select plan(3);

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

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_schedule_id uuid := gen_random_uuid();
  v_audit_first uuid := gen_random_uuid();
  v_audit_second uuid := gen_random_uuid();
  v_proposal record;
begin
  select
    pp.id as proposal_id,
    sr.id as service_request_id,
    sr.client_id
  into v_proposal
  from public.provider_proposals pp
  join public.service_requests sr on sr.id = pp.service_request_id
  order by pp.id
  limit 1;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_service_id,
    v_proposal.service_request_id,
    v_proposal.proposal_id,
    v_proposal.client_id,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'hours', 2, current_date, 'morning',
    '{"start_date":"today","shift":"morning"}'::jsonb,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    id,
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
    idempotency_key
  )
  values (
    v_schedule_id,
    v_service_id,
    v_proposal.client_id,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'netcred',
    1,
    100.00,
    10.00,
    90.00,
    now() + interval '24 hours',
    'SCHEDULED'::public.payment_schedule_state,
    v_service_id::text
  );

  insert into public.payment_audit_log (
    id,
    event_type,
    entity_type,
    entity_id,
    service_id,
    schedule_id,
    from_state,
    to_state,
    actor,
    metadata,
    created_at
  )
  values
    (
      v_audit_first,
      'SCHEDULE_CREATED',
      'payment_schedule',
      v_schedule_id,
      v_service_id,
      v_schedule_id,
      null,
      'SCHEDULED',
      'system',
      '{}'::jsonb,
      timestamptz '2026-06-01 10:00:00+00'
    ),
    (
      v_audit_second,
      'CHARGE_RESCHEDULED',
      'payment_schedule',
      v_schedule_id,
      null,
      v_schedule_id,
      'SCHEDULED',
      'SCHEDULED',
      'system',
      '{"reason":"test"}'::jsonb,
      timestamptz '2026-06-02 10:00:00+00'
    );

  perform set_config('test.audit_lifecycle.service_id', v_service_id::text, true);
  perform set_config('test.audit_lifecycle.first_id', v_audit_first::text, true);
  perform set_config('test.audit_lifecycle.second_id', v_audit_second::text, true);
end;
$seed$;

select is(
  jsonb_array_length(
    public.payment_reconstruct_audit_lifecycle(
      current_setting('test.audit_lifecycle.service_id')::uuid
    )
  ),
  2,
  'returns all audit entries for service_id and linked schedule_id'
);

select is(
  (
    public.payment_reconstruct_audit_lifecycle(
      current_setting('test.audit_lifecycle.service_id')::uuid
    )->0->>'id'
  ),
  current_setting('test.audit_lifecycle.first_id'),
  'orders audit entries chronologically by created_at'
);

select is(
  (
    public.payment_reconstruct_audit_lifecycle(
      current_setting('test.audit_lifecycle.service_id')::uuid
    )->1->>'event_type'
  ),
  'CHARGE_RESCHEDULED',
  'includes schedule-only rows matched via schedule_id'
);

select * from finish();
rollback;
