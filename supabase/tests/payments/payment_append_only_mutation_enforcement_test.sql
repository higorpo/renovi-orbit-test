-- pgTAP: payment Task 127 — append-only enforcement on payment_audit_log and payment_attempts.

begin;

select plan(8);

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

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_audit_log'
      and t.tgname = 'payment_audit_log_deny_mutation'
      and not t.tgisinternal
  ),
  'payment_audit_log_deny_mutation trigger exists'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_attempts'
      and t.tgname = 'payment_attempts_deny_mutation'
      and not t.tgisinternal
  ),
  'payment_attempts_deny_mutation trigger exists'
);

do $seed$
declare
  v_audit_id uuid;
  v_attempt_id uuid;
  v_schedule_id uuid;
  v_service_id uuid := gen_random_uuid();
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_pricing record;
  v_slot jsonb;
begin
  v_audit_id := public.payment_write_audit(
    p_event_type := 'APPEND_ONLY_FIXTURE',
    p_entity_type := 'payment_schedule',
    p_entity_id := gen_random_uuid(),
    p_actor := 'system'::public.payment_audit_actor
  );

  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('append only pgTAP %s', v_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.payment_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 3, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_service_request_id, v_pricing.original_amount,
    'append only pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_service_id, v_service_request_id, v_proposal_id, v_client_id,
    v_provider_id, 'hours', 2, current_date + 3, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at,
    state, idempotency_key,
    gateway_reference_code)
  values (
    v_service_id, v_client_id, v_provider_id, 1,
    100.00, 10.00, 90.00, now() + interval '2 days',
    'SCHEDULED'::public.payment_schedule_state, v_service_id::text,
    v_service_id)
  returning id into v_schedule_id;

  insert into public.payment_attempts (
    schedule_id,
    attempt_number,
    initiator,
    outcome
  )
  values (
    v_schedule_id,
    99,
    'cron'::public.payment_attempt_initiator,
    'ERROR'::public.payment_attempt_outcome
  )
  returning id into v_attempt_id;

  perform set_config('test.append_only.audit_id', v_audit_id::text, true);
  perform set_config('test.append_only.attempt_id', v_attempt_id::text, true);
end;
$seed$;

select throws_ok(
  format(
    $$ update public.payment_audit_log
       set event_type = 'TAMPERED'
       where id = %L::uuid $$,
    current_setting('test.append_only.audit_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'UPDATE on payment_audit_log is blocked by append-only trigger'
);

select throws_ok(
  format(
    $$ delete from public.payment_audit_log
       where id = %L::uuid $$,
    current_setting('test.append_only.audit_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'DELETE on payment_audit_log is blocked by append-only trigger'
);

select throws_ok(
  format(
    $$ update public.payment_attempts
       set outcome = 'PAID'::public.payment_attempt_outcome
       where id = %L::uuid $$,
    current_setting('test.append_only.attempt_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'UPDATE on payment_attempts is blocked by append-only trigger'
);

select throws_ok(
  format(
    $$ delete from public.payment_attempts
       where id = %L::uuid $$,
    current_setting('test.append_only.attempt_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'DELETE on payment_attempts is blocked by append-only trigger'
);

select ok(
  not has_table_privilege('service_role', 'public.payment_audit_log', 'UPDATE')
    and not has_table_privilege('service_role', 'public.payment_audit_log', 'DELETE')
    and not has_table_privilege('service_role', 'public.payment_audit_log', 'TRUNCATE'),
  'service_role lacks UPDATE, DELETE, and TRUNCATE on payment_audit_log'
);

select ok(
  not has_table_privilege('service_role', 'public.payment_attempts', 'UPDATE')
    and not has_table_privilege('service_role', 'public.payment_attempts', 'DELETE')
    and not has_table_privilege('service_role', 'public.payment_attempts', 'TRUNCATE'),
  'service_role lacks UPDATE, DELETE, and TRUNCATE on payment_attempts'
);

select finish();
rollback;
