-- pgTAP: payment Task 126 — MMD payload builders for payment_enqueue_notifications.

begin;

select plan(12);

select is(
  public.payment_notification_deep_link_path(
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  ),
  '/dashboard/services/7017e457-5a32-44e7-b8da-1727a14f4d33',
  'payment deep link opens service detail route when service_request_id is known'
);

select is(
  public.payment_notification_deep_link_path(null),
  '/dashboard/services',
  'payment deep link falls back to services list when service_request_id is missing'
);

select is(
  public.payment_build_notification_bypass_flags(
    'CHARGE_FAILED_PERMANENT',
    'client',
    false
  )->>'bypass_priority',
  'true',
  'FAILED_PERMANENT client payload requests bypass priority'
);

select is(
  public.payment_build_notification_bypass_flags(
    'CHARGE_FAILED_PERMANENT',
    'provider',
    false
  )->>'bypass_priority',
  'true',
  'FAILED_PERMANENT provider payload requests bypass priority'
);

select is(
  public.payment_build_notification_bypass_flags(
    'CHARGE_SUCCEEDED',
    'provider',
    true
  )->>'urgent_provider',
  'true',
  'urgent provider path sets urgent_provider flag'
);

select is(
  public.payment_build_notification_bypass_flags(
    'CHARGE_SUCCEEDED',
    'provider',
    false
  )->>'bypass_priority',
  'false',
  'non-urgent provider CHARGE_SUCCEEDED does not request bypass priority'
);

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

create or replace function pg_temp.payment_seed_notification_fixture(
  p_contracted_service_id uuid,
  p_provider_id uuid,
  p_hours_until_execution int default 6
)
returns table (
  schedule_id uuid,
  client_id uuid,
  service_request_id uuid
)
language plpgsql
as $$
declare
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb;
  v_schedule_id uuid;
  v_start_date date;
begin
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
    format('notification payload pgTAP %s', p_contracted_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', p_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.payment_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_start_date := current_date;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, p_provider_id, v_service_request_id, v_pricing.original_amount,
    'notification payload pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    p_contracted_service_id, v_service_request_id, v_proposal_id, v_client_id,
    p_provider_id, 'hours', 2, v_start_date, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount
  )
  values (
    p_contracted_service_id, v_client_id, p_provider_id, 'netcred',
    1, 100.00, 10.00, 90.00,
    now() - interval '1 hour',
    'PAID'::public.payment_schedule_state,
    p_contracted_service_id::text,
    now(),
    102.50
  )
  returning id into v_schedule_id;

  schedule_id := v_schedule_id;
  client_id := v_client_id;
  service_request_id := v_service_request_id;
  return next;
end;
$$;

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_contracted_service_id uuid := gen_random_uuid();
  v_fixture record;
begin
  perform pg_temp.payment_set_service_role();

  select * into v_fixture
  from pg_temp.payment_seed_notification_fixture(v_contracted_service_id, v_provider_id, 6);

  perform set_config('test.payload.schedule_id', v_fixture.schedule_id::text, true);
  perform set_config('test.payload.service_request_id', v_fixture.service_request_id::text, true);
  perform set_config('test.payload.contracted_service_id', v_contracted_service_id::text, true);
end;
$seed$;

select pg_temp.payment_set_service_role();

select is(
  (
    select public.payment_enqueue_notifications(
      current_setting('test.payload.schedule_id')::uuid,
      'CHARGE_SUCCEEDED'
    )->>'urgent_provider'
  ),
  'true',
  'payment_enqueue_notifications marks urgent_provider within 24h of execution'
);

select ok(
  (
    select jsonb_array_length(
      public.payment_enqueue_notifications(
        current_setting('test.payload.schedule_id')::uuid,
        'CHARGE_SUCCEEDED'
      )->'dispatches'
    ) = 2
  ),
  'CHARGE_SUCCEEDED enqueues client and provider dispatches'
);

select is(
  (
    select public.payment_build_notification_variables(
      ps,
      'CHARGE_SUCCEEDED',
      'client',
      current_setting('test.payload.service_request_id')::uuid,
      cs.service_execution_at,
      '{}'::jsonb
    )->>'deep_link_path'
    from public.payment_schedules ps
    inner join public.contracted_services cs on cs.id = ps.contracted_service_id
    where ps.id = current_setting('test.payload.schedule_id')::uuid
  ),
  format(
    '/dashboard/services/%s',
    current_setting('test.payload.service_request_id')
  ),
  'payload builder includes service detail deep_link_path'
);

select is(
  (
    select public.payment_build_notification_variables(
      ps,
      'UPCOMING_CHARGE',
      'client',
      current_setting('test.payload.service_request_id')::uuid,
      cs.service_execution_at,
      '{}'::jsonb,
      'Pintura da sala'
    )->>'charge_amount_formatted'
    from public.payment_schedules ps
    inner join public.contracted_services cs on cs.id = ps.contracted_service_id
    where ps.id = current_setting('test.payload.schedule_id')::uuid
  ),
  'R$ 100,00',
  'payload builder formats upcoming charge amount from schedule base_amount'
);

select is(
  public.payment_format_service_execution_summary(
    current_date,
    'morning',
    null
  ),
  to_char(current_date, 'DD/MM/YYYY') || ', turno da manhã',
  'service execution summary formats date and shift in PT-BR'
);

select is(
  public.payment_build_notification_dispatch_metadata(
    'CHARGE_FAILED_PERMANENT',
    'client',
    false,
    jsonb_build_object('source_detail', 'pgtap')
  )->>'bypass_priority',
  'true',
  'dispatch metadata merges bypass flags with caller metadata'
);

select finish();

rollback;
