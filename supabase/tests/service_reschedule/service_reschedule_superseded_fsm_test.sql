-- pgTAP: SUPERSEDED FSM transitions and blocked in-place re-propose.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(5);

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_other_service_id uuid := gen_random_uuid();
  v_fixture record;
  v_other_fixture record;
  v_req_id uuid;
begin
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(v_service_id);

  select * into v_other_fixture
  from pg_temp.service_reschedule_seed_service(v_other_service_id);

  v_req_id := pg_temp.service_reschedule_insert_request(
    v_service_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );

  update public.service_reschedule_requests srr
  set
    status = 'PROPOSED'::public.service_reschedule_request_status,
    proposed_slot = jsonb_build_object('start_date', '2026-08-12', 'shift', 'morning'),
    proposed_at = now()
  where srr.id = v_req_id;

  update public.service_reschedule_requests srr
  set status = 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
  where srr.id = v_req_id;

  perform set_config('test.superseded_fsm.req_id', v_req_id::text, true);
  perform set_config('test.superseded_fsm.service_id', v_service_id::text, true);
  perform set_config('test.superseded_fsm.other_service_id', v_other_service_id::text, true);
  perform set_config('test.superseded_fsm.other_chat_id', v_other_fixture.chat_id::text, true);
  perform set_config('test.superseded_fsm.other_client_id', v_other_fixture.client_id::text, true);
end;
$seed$;

select throws_ok(
  format(
    $$ update public.service_reschedule_requests
       set status = 'PROPOSED'
       where id = %L::uuid $$,
    current_setting('test.superseded_fsm.req_id')
  ),
  '23514',
  'INVALID_RESCHEDULE_STATUS_TRANSITION',
  'FSM blocks ADJUSTMENT_REQUESTED to PROPOSED in-place update'
);

select throws_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id,
        chat_id,
        status,
        requested_by_role,
        requested_by_profile_id,
        original_slot,
        original_service_execution_at,
        proposed_slot,
        proposed_at,
        parent_request_id,
        idempotency_key
      )
      select
        srr.contracted_service_id,
        srr.chat_id,
        'PROPOSED',
        srr.requested_by_role,
        srr.requested_by_profile_id,
        srr.original_slot,
        srr.original_service_execution_at,
        jsonb_build_object('start_date', '2026-08-14', 'shift', 'afternoon'),
        now(),
        srr.id,
        gen_random_uuid()
      from public.service_reschedule_requests srr
      where srr.id = %L::uuid
    $sql$,
    current_setting('test.superseded_fsm.req_id')
  ),
  '23514',
  'PARENT_RESCHEDULE_NOT_SUPERSEDED',
  'parent consistency trigger requires superseded parent before child insert'
);

select lives_ok(
  format(
    $$ update public.service_reschedule_requests
       set status = 'SUPERSEDED'
       where id = %L::uuid $$,
    current_setting('test.superseded_fsm.req_id')
  ),
  'FSM allows ADJUSTMENT_REQUESTED to SUPERSEDED transition'
);

select throws_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id,
        chat_id,
        status,
        requested_by_role,
        requested_by_profile_id,
        original_slot,
        original_service_execution_at,
        proposed_slot,
        proposed_at,
        parent_request_id,
        idempotency_key
      )
      select
        %L::uuid,
        %L::uuid,
        'PROPOSED',
        'client',
        %L::uuid,
        srr.original_slot,
        srr.original_service_execution_at,
        jsonb_build_object('start_date', '2026-08-14', 'shift', 'afternoon'),
        now(),
        srr.id,
        gen_random_uuid()
      from public.service_reschedule_requests srr
      where srr.id = %L::uuid
    $sql$,
    current_setting('test.superseded_fsm.other_service_id'),
    current_setting('test.superseded_fsm.other_chat_id'),
    current_setting('test.superseded_fsm.other_client_id'),
    current_setting('test.superseded_fsm.req_id')
  ),
  '23514',
  'PARENT_RESCHEDULE_SERVICE_MISMATCH',
  'parent consistency trigger rejects cross-service parent'
);

select lives_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id,
        chat_id,
        status,
        requested_by_role,
        requested_by_profile_id,
        original_slot,
        original_service_execution_at,
        proposed_slot,
        proposed_at,
        parent_request_id,
        idempotency_key
      )
      select
        srr.contracted_service_id,
        srr.chat_id,
        'PROPOSED',
        srr.requested_by_role,
        srr.requested_by_profile_id,
        srr.original_slot,
        srr.original_service_execution_at,
        jsonb_build_object('start_date', '2026-08-14', 'shift', 'afternoon'),
        now(),
        srr.id,
        gen_random_uuid()
      from public.service_reschedule_requests srr
      where srr.id = %L::uuid
    $sql$,
    current_setting('test.superseded_fsm.req_id')
  ),
  'parent consistency trigger accepts same-service superseded parent'
);

select * from finish();

rollback;
