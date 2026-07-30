-- pgTAP: far-reschedule prepare/commit, unique partial, claim batch, auth grants.

begin;

select plan(18);

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
  $$ select public.payment_prepare_far_reschedule_recapture(gen_random_uuid(), null) $$,
  '42501',
  'service_role required for payment_prepare_far_reschedule_recapture',
  'prepare rejects authenticated/anon'
);

select throws_ok(
  $$ select public.payment_commit_far_reschedule_after_gateway(gen_random_uuid(), null) $$,
  '42501',
  'service_role required for payment_commit_far_reschedule_after_gateway',
  'commit rejects non-service_role'
);

select throws_ok(
  $$ select public.payment_claim_far_reschedule_recapture_batch(5) $$,
  '42501',
  'service_role required for payment_claim_far_reschedule_recapture_batch',
  'claim rejects non-service_role'
);

select pg_temp.payment_set_service_role();

do $seed$
declare
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_cs uuid := gen_random_uuid();
  v_sr uuid := gen_random_uuid();
  v_proposal uuid := gen_random_uuid();
  v_schedule_id uuid;
  v_pricing record;
  v_far_date date := current_date + 25;
  v_slot jsonb;
  v_chat_id uuid;
begin
  select sr.client_id into v_client_id
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
  from public.calculate_provider_service_pricing(1000.00::numeric);

  perform pg_temp.payment_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(v_far_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select v_sr, sr.client_id, sr.service_id, sr.address_id, 'far commit pgTAP',
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  ) values (
    v_proposal, v_provider_id, v_sr, v_pricing.original_amount, 'far commit', 1, 'days',
    jsonb_build_array(v_slot), '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount,
    v_pricing.final_amount, v_pricing.pricing_signature, 'ACCEPTED'
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  ) values (
    v_cs, v_sr, v_proposal, v_client_id, v_provider_id, 'days', 1,
    v_far_date, v_far_date, 'morning', v_slot, 'CONFIRMED'
  );

  insert into public.chats (
    service_request_id, client_id, provider_id, status, last_interaction_at
  ) values (
    v_sr, v_client_id, v_provider_id, 'ACTIVE'::public.cns_conversation_status, now()
  )
  returning id into v_chat_id;

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id,
    far_recapture_pending_at, clearsale_session_id, client_ip_address
  ) values (
    v_cs, v_client_id, v_provider_id, 1, 1000.00, 15.00, 850.00,
    now() - interval '2 days', 'PAID', v_cs::text, v_cs,
    now() - interval '1 day', 1024.29, 'txn-far-commit',
    now(), 'clearsale-session-1', '127.0.0.1'
  )
  returning id into v_schedule_id;

  perform set_config('test.far_commit.cs', v_cs::text, true);
  perform set_config('test.far_commit.schedule', v_schedule_id::text, true);
  perform set_config('test.far_commit.chat', v_chat_id::text, true);
end;
$seed$;

-- Guard: no pending
update public.payment_schedules
set far_recapture_pending_at = null
where id = current_setting('test.far_commit.schedule')::uuid;

select throws_ok(
  $$
    select public.payment_prepare_far_reschedule_recapture(
      current_setting('test.far_commit.schedule')::uuid,
      null
    )
  $$,
  'P0001',
  'FAR_RECAPTURE_NOT_PENDING',
  'prepare rejects without pending flag'
);

update public.payment_schedules
set far_recapture_pending_at = now()
where id = current_setting('test.far_commit.schedule')::uuid;

select is(
  (
    select public.payment_prepare_far_reschedule_recapture(
      current_setting('test.far_commit.schedule')::uuid,
      null
    )->>'refund_amount'
  ),
  '1024.29',
  'prepare returns full paid_amount as refund'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.far_commit.cs')::uuid
  ),
  'CONFIRMED',
  'prepare does not cancel contracted service'
);

select is(
  (
    select c.status::text
    from public.chats c
    where c.id = current_setting('test.far_commit.chat')::uuid
  ),
  'ACTIVE',
  'prepare leaves chat open'
);

select is(
  jsonb_array_length(
    public.payment_claim_far_reschedule_recapture_batch(10)
  ) >= 1,
  true,
  'claim batch returns pending far-recapture schedules'
);

select lives_ok(
  $$
    select public.payment_commit_far_reschedule_after_gateway(
      current_setting('test.far_commit.schedule')::uuid,
      1024.29
    )
  $$,
  'commit after gateway succeeds'
);

select is(
  (
    select ps.state::text
    from public.payment_schedules ps
    where ps.id = current_setting('test.far_commit.schedule')::uuid
  ),
  'REFUNDED',
  'commit moves old schedule to REFUNDED'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    where cs.id = current_setting('test.far_commit.cs')::uuid
  ),
  'PENDING_PAYMENT',
  'commit sets contracted service to PENDING_PAYMENT'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far_commit.cs')::uuid
      and ps.state = 'SCHEDULED'
      and ps.supersedes_schedule_id = current_setting('test.far_commit.schedule')::uuid
  ),
  1,
  'commit creates exactly one new SCHEDULED cycle'
);

select ok(
  (
    select ps.idempotency_key like (ps.contracted_service_id::text || ':c%')
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far_commit.cs')::uuid
      and ps.state = 'SCHEDULED'
  ),
  'new cycle uses cycle idempotency_key'
);

select ok(
  (
    select ps.far_recapture_pending_at is null
    from public.payment_schedules ps
    where ps.id = current_setting('test.far_commit.schedule')::uuid
  ),
  'commit clears far_recapture_pending_at'
);

select is(
  (
    select c.status::text
    from public.chats c
    where c.id = current_setting('test.far_commit.chat')::uuid
  ),
  'ACTIVE',
  'commit does not close chat'
);

select is(
  public.payment_commit_far_reschedule_after_gateway(
    current_setting('test.far_commit.schedule')::uuid,
    1024.29
  )->>'outcome',
  'already_done',
  'commit is idempotent when already REFUNDED + new SCHEDULED'
);

select throws_ok(
  $$
    insert into public.payment_schedules (
      contracted_service_id, client_id, provider_id, installment_number,
      base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
      idempotency_key, gateway_reference_code
    )
    select
      ps.contracted_service_id, ps.client_id, ps.provider_id, 1,
      1000.00, 15.00, 850.00, now() + interval '10 days', 'SCHEDULED',
      ps.contracted_service_id::text || ':c99', gen_random_uuid()
    from public.payment_schedules ps
    where ps.contracted_service_id = current_setting('test.far_commit.cs')::uuid
      and ps.state = 'SCHEDULED'
    limit 1
  $$,
  '23505',
  null,
  'partial unique rejects second active schedule on same CS'
);

select is(
  jsonb_array_length(
    public.payment_claim_far_reschedule_recapture_batch(10)
  ),
  0,
  'claim does not return already processed schedules'
);

select finish();

rollback;
