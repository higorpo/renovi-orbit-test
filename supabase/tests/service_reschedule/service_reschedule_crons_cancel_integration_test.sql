-- pgTAP: service reschedule cancellation integration, expiration janitor, and SLA reminders.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(30);

select pg_temp.service_reschedule_set_service_role();

select throws_ok(
  $$ select public.expire_stale_service_reschedule_requests(501) $$,
  '22023',
  'p_batch_size must be between 1 and 500',
  'expiration janitor rejects oversized batch'
);

select throws_ok(
  $$ select public.enqueue_service_reschedule_reminders(501) $$,
  '22023',
  'p_batch_size must be between 1 and 500',
  'SLA reminder job rejects oversized batch'
);

do $seed$
declare
  v_pre_id uuid := gen_random_uuid();
  v_refund_id uuid := gen_random_uuid();
  v_auto_id uuid := gen_random_uuid();
  v_expire_id uuid := gen_random_uuid();
  v_proposed_due_id uuid := gen_random_uuid();
  v_proposed_future_id uuid := gen_random_uuid();
  v_svc_cancelled_id uuid := gen_random_uuid();
  v_no_schedule_id uuid := gen_random_uuid();
  v_reminder_id uuid := gen_random_uuid();
  v_urgent_id uuid := gen_random_uuid();
  v_fixture record;
  v_req_id uuid;
begin
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_pre_id,
    p_service_status := 'PENDING_PAYMENT'::public.contracted_service_status
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_pre_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key,
    gateway_reference_code)
  values (
    v_pre_id, v_fixture.client_id, v_fixture.provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() + interval '5 days',
    'SCHEDULED'::public.payment_schedule_state, v_pre_id::text,
    v_pre_id);
  perform set_config('test.cron.pre_id', v_pre_id::text, true);
  perform set_config('test.cron.pre_req_id', v_req_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(v_refund_id);
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_refund_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, paid_at, paid_amount, gateway_transaction_id,
    gateway_reference_code)
  values (
    v_refund_id, v_fixture.client_id, v_fixture.provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 day',
    'PAID'::public.payment_schedule_state, v_refund_id::text,
    now() - interval '1 day', 110.00, 'txn-service-reschedule-refund',
    v_refund_id);
  perform set_config('test.cron.refund_id', v_refund_id::text, true);
  perform set_config('test.cron.refund_req_id', v_req_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_auto_id,
    p_scheduled_start_date := current_date,
    p_service_status := 'PENDING_PAYMENT'::public.contracted_service_status
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_auto_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, gateway_slug,
    installment_number, base_amount, commission_rate_pct, provider_payout,
    charge_scheduled_at, state, idempotency_key, failure_reason,
    gateway_reference_code)
  values (
    v_auto_id, v_fixture.client_id, v_fixture.provider_id, 'netcred',
    1, 100.00, 10.00, 90.00, now() - interval '1 hour',
    'FAILED'::public.payment_schedule_state, v_auto_id::text, 'CARD_DECLINED',
    v_auto_id);
  perform set_config('test.cron.auto_id', v_auto_id::text, true);
  perform set_config('test.cron.auto_req_id', v_req_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_expire_id,
    p_scheduled_start_date := current_date - 3,
    p_service_status := 'EXECUTED'::public.contracted_service_status
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_expire_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    p_created_at := now() - interval '3 days'
  );
  perform set_config('test.cron.expire_req_id', v_req_id::text, true);
  perform set_config('test.cron.expire_chat_id', v_fixture.chat_id::text, true);

  -- Proposed start_date = business today → must expire.
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_proposed_due_id,
    p_scheduled_start_date := public.cns_business_today() + 5
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_proposed_due_id,
    v_fixture.chat_id,
    'provider'::public.service_reschedule_requested_by_role,
    v_fixture.provider_id,
    p_status := 'PROPOSED'::public.service_reschedule_request_status,
    p_proposed_slot := jsonb_build_object(
      'start_date', to_char(public.cns_business_today(), 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  );
  perform set_config('test.cron.proposed_due_req_id', v_req_id::text, true);

  -- Proposed start_date = tomorrow → must stay PROPOSED (negative control).
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_proposed_future_id,
    p_scheduled_start_date := public.cns_business_today() + 5
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_proposed_future_id,
    v_fixture.chat_id,
    'provider'::public.service_reschedule_requested_by_role,
    v_fixture.provider_id,
    p_status := 'PROPOSED'::public.service_reschedule_request_status,
    p_proposed_slot := jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 1, 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  );
  perform set_config('test.cron.proposed_future_req_id', v_req_id::text, true);

  -- Service already CANCELLED with open request → janitor cancels (not expires).
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_svc_cancelled_id,
    p_service_status := 'CANCELLED'::public.contracted_service_status
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_svc_cancelled_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    p_status := 'PROPOSED'::public.service_reschedule_request_status,
    p_proposed_slot := jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'),
      'shift', 'afternoon'
    )
  );
  perform set_config('test.cron.svc_cancelled_req_id', v_req_id::text, true);

  -- No payment schedule: cns_confirm_service_cancellation must cancel open request.
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_no_schedule_id,
    p_service_status := 'PENDING_PAYMENT'::public.contracted_service_status
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_no_schedule_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    p_status := 'PROPOSED'::public.service_reschedule_request_status,
    p_proposed_slot := jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 4, 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  );
  perform set_config('test.cron.no_schedule_id', v_no_schedule_id::text, true);
  perform set_config('test.cron.no_schedule_req_id', v_req_id::text, true);
  perform set_config('test.cron.no_schedule_client_id', v_fixture.client_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(v_reminder_id);
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_reminder_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    p_created_at := now() - interval '7 hours'
  );
  perform set_config('test.cron.reminder_req_id', v_req_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_urgent_id,
    p_scheduled_start_date := current_date + 1
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_urgent_id,
    v_fixture.chat_id,
    'provider'::public.service_reschedule_requested_by_role,
    v_fixture.provider_id,
    p_created_at := now()
  );
  perform set_config('test.cron.urgent_req_id', v_req_id::text, true);
  perform set_config('test.cron.actor_client_id', v_fixture.client_id::text, true);
  perform set_config('test.cron.actor_provider_id', v_fixture.provider_id::text, true);
end;
$seed$;

select lives_ok(
  format(
    $$ select public.payment_pre_charge_cancel(%L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client') $$,
    current_setting('test.cron.pre_id'),
    current_setting('test.cron.actor_client_id')
  ),
  'pre-charge cancellation succeeds with active reschedule'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.pre_req_id')::uuid
  ),
  'CANCELLED',
  'pre-charge cancellation cancels active reschedule request'
);

select lives_ok(
  format(
    $$ select public.payment_commit_refund_after_gateway(
         %L::uuid, %L::uuid, 'CLIENT_INITIATED', 'client', null
       ) $$,
    current_setting('test.cron.refund_id'),
    current_setting('test.cron.actor_client_id')
  ),
  'refund commit succeeds with active reschedule'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.refund_req_id')::uuid
  ),
  'CANCELLED',
  'refund commit cancels active reschedule request'
);

select lives_ok(
  $$ select public.payment_auto_cancel_services(500) $$,
  'auto-cancel batch succeeds with active reschedule'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.auto_req_id')::uuid
  ),
  'CANCELLED',
  'auto-cancel batch cancels active reschedule request'
);

-- cancelled_no_schedule path cancels open reschedule before marking service CANCELLED.
select pg_temp.service_reschedule_set_auth(
  current_setting('test.cron.no_schedule_client_id')::uuid
);

select is(
  public.cns_confirm_service_cancellation(
    current_setting('test.cron.no_schedule_id')::uuid
  )->>'outcome',
  'cancelled_no_schedule',
  'cns_confirm without payment schedule returns cancelled_no_schedule'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.no_schedule_req_id')::uuid
  ),
  'CANCELLED',
  'cancelled_no_schedule cancels active reschedule request'
);

select pg_temp.service_reschedule_set_service_role();

create temp table _expire_result as
select public.expire_stale_service_reschedule_requests(50) as payload;

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.expire_req_id')::uuid
  ),
  'EXPIRED',
  'expiration janitor expires active request for terminal service'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.proposed_due_req_id')::uuid
  ),
  'EXPIRED',
  'expiration janitor expires PROPOSED when proposed start_date is today'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.proposed_future_req_id')::uuid
  ),
  'PROPOSED',
  'expiration janitor leaves PROPOSED when proposed start_date is tomorrow'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.cron.svc_cancelled_req_id')::uuid
  ),
  'CANCELLED',
  'expiration janitor cancels open request when contracted service is CANCELLED'
);

select ok(
  (select (payload->>'expired_count')::int >= 2 from _expire_result),
  'expiration janitor reports at least two expired requests'
);

select ok(
  (select (payload->>'cancelled_count')::int >= 1 from _expire_result),
  'expiration janitor reports at least one cancelled request for CANCELLED service'
);

select is(
  (
    select count(*)::int
    from public.chat_messages m
    where m.chat_id = current_setting('test.cron.expire_chat_id')::uuid
      and m.linked_entity_id = current_setting('test.cron.expire_req_id')::uuid
      and m.payload->>'text' like '%solicitação de reagendamento expirou%'
  ),
  1,
  'expiration janitor inserts deterministic expiration system message'
);

create temp table _reminder_result as
select public.enqueue_service_reschedule_reminders(10) as payload;

select ok(
  (select (payload->>'processed_count')::int >= 2 from _reminder_result),
  'SLA reminder job processes regular and urgent requests'
);

select is(
  (
    select reminder_count
    from public.service_reschedule_requests
    where id = current_setting('test.cron.reminder_req_id')::uuid
  ),
  1,
  'regular reminder increments reminder_count'
);

select ok(
  (
    select last_reminder_at is not null
    from public.service_reschedule_requests
    where id = current_setting('test.cron.reminder_req_id')::uuid
  ),
  'regular reminder stores last_reminder_at'
);

select is(
  (
    select reminder_count
    from public.service_reschedule_requests
    where id = current_setting('test.cron.urgent_req_id')::uuid
  ),
  0,
  'urgent reminder does not consume regular reminder budget'
);

select ok(
  (
    select urgent_reminder_sent_at is not null
    from public.service_reschedule_requests
    where id = current_setting('test.cron.urgent_req_id')::uuid
  ),
  'urgent reminder marks urgent_reminder_sent_at'
);

select lives_ok(
  $$ select public.cron_expire_stale_service_reschedule_requests() $$,
  'expiration cron wrapper runs and records job_runs telemetry'
);

select ok(
  exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'expire_stale_service_reschedule_requests'
      and jr.finished_at is not null
      and jr.error_count = 0
  ),
  'expiration cron wrapper writes succeeded job_run'
);

select lives_ok(
  $$ select public.cron_enqueue_service_reschedule_reminders() $$,
  'reminder cron wrapper runs and records job_runs telemetry'
);

select ok(
  exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'enqueue_service_reschedule_reminders'
      and jr.finished_at is not null
      and jr.error_count = 0
  ),
  'reminder cron wrapper writes succeeded job_run'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'expire_stale_service_reschedule_requests'
      and j.schedule = '*/15 * * * *'
  ),
  'expiration cron schedule is registered'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'enqueue_service_reschedule_reminders'
      and j.schedule = '0 * * * *'
  ),
  'reminder cron schedule is registered'
);

select ok(
  has_function_privilege('postgres', 'public.cron_enqueue_service_reschedule_reminders()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.cron_enqueue_service_reschedule_reminders()', 'EXECUTE'),
  'reminder cron wrapper grants execute only to postgres among product roles'
);

select ok(
  has_function_privilege('postgres', 'public.cron_expire_stale_service_reschedule_requests()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.cron_expire_stale_service_reschedule_requests()', 'EXECUTE'),
  'expiration cron wrapper grants execute only to postgres among product roles'
);

select finish();

rollback;
