-- pgTAP: service reschedule RPC guards, idempotency, and action permissions.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(21);

do $seed$
declare
  v_main_id uuid := gen_random_uuid();
  v_no_chat_id uuid := gen_random_uuid();
  v_closed_chat_id uuid := gen_random_uuid();
  v_pending_id uuid := gen_random_uuid();
  v_window_id uuid := gen_random_uuid();
  v_terminal_id uuid := gen_random_uuid();
  v_adjust_id uuid := gen_random_uuid();
  v_cancel_id uuid := gen_random_uuid();
  v_fixture record;
  v_req_id uuid;
  v_proposed_slot jsonb;
  v_other_profile_id uuid;
begin
  select * into v_fixture from pg_temp.service_reschedule_seed_service(v_main_id);
  perform set_config('test.rpc.main_service_id', v_main_id::text, true);
  perform set_config('test.rpc.main_chat_id', v_fixture.chat_id::text, true);
  perform set_config('test.rpc.client_id', v_fixture.client_id::text, true);
  perform set_config('test.rpc.provider_id', v_fixture.provider_id::text, true);

  select p.id
  into v_other_profile_id
  from public.profiles p
  where p.id not in (v_fixture.client_id, v_fixture.provider_id)
  order by p.id
  limit 1;
  perform set_config('test.rpc.other_profile_id', v_other_profile_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_no_chat_id,
    p_with_chat := false
  );
  perform set_config('test.rpc.no_chat_service_id', v_no_chat_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_closed_chat_id,
    p_chat_status := 'CLOSED'::public.cns_conversation_status
  );
  perform set_config('test.rpc.closed_chat_service_id', v_closed_chat_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_pending_id,
    p_service_status := 'PENDING_PAYMENT'::public.contracted_service_status
  );
  perform set_config('test.rpc.pending_service_id', v_pending_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_window_id,
    p_scheduled_start_date := current_date + 1,
    p_service_status := 'CONFIRMED'::public.contracted_service_status
  );
  perform set_config('test.rpc.window_service_id', v_window_id::text, true);

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(
    v_terminal_id,
    p_service_status := 'CANCELLED'::public.contracted_service_status
  );
  perform set_config('test.rpc.terminal_service_id', v_terminal_id::text, true);

  select * into v_fixture from pg_temp.service_reschedule_seed_service(v_adjust_id);
  v_proposed_slot := jsonb_build_object(
    'start_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'),
    'end_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  );
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_adjust_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    'PROPOSED'::public.service_reschedule_request_status,
    now(),
    v_proposed_slot,
    5
  );
  perform set_config('test.rpc.adjust_req_id', v_req_id::text, true);

  select * into v_fixture from pg_temp.service_reschedule_seed_service(v_cancel_id);
  v_req_id := pg_temp.service_reschedule_insert_request(
    v_cancel_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id,
    'PROPOSED'::public.service_reschedule_request_status,
    now(),
    v_proposed_slot
  );
  perform set_config('test.rpc.cancel_req_id', v_req_id::text, true);
end;
$seed$;

select is(
  public.cns_service_reschedule_snapshot_for_viewer(
    current_setting('test.rpc.main_service_id')::uuid,
    current_setting('test.rpc.other_profile_id')::uuid
  ),
  null,
  'snapshot returns null for non-participant viewer'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_viewer(
      current_setting('test.rpc.main_service_id')::uuid,
      current_setting('test.rpc.client_id')::uuid
    )->>'can_client_request_reschedule'
  )::boolean,
  'client can request future confirmed service before cutoff'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_viewer(
      current_setting('test.rpc.main_service_id')::uuid,
      current_setting('test.rpc.provider_id')::uuid
    )->>'can_provider_request_reschedule'
  )::boolean,
  'provider can initiate reschedule for confirmed service'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.client_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.no_chat_service_id')
  ),
  'P0002',
  'CHAT_NOT_FOUND',
  'request RPC rejects contracted service without chat'
);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.closed_chat_service_id')
  ),
  'P0001',
  'CHAT_NOT_ACTIVE',
  'request RPC rejects inactive chat'
);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.window_service_id')
  ),
  'P0001',
  'CLIENT_RESCHEDULE_WINDOW_CLOSED',
  'client request RPC enforces request window cutoff'
);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.terminal_service_id')
  ),
  'P0001',
  'RESCHEDULE_NOT_ALLOWED',
  'request RPC rejects terminal contracted service'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.provider_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.pending_service_id')
  ),
  'P0001',
  'PROVIDER_RESCHEDULE_REQUIRES_CONFIRMED',
  'provider request RPC requires confirmed service'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.client_id')::uuid);

create temp table _rpc_request_once as
select public.cns_request_service_reschedule(
  current_setting('test.rpc.main_service_id')::uuid,
  '11111111-1111-7111-8111-111111111111'::uuid,
  repeat('a', 650)
) as response;

create temp table _rpc_request_twice as
select public.cns_request_service_reschedule(
  current_setting('test.rpc.main_service_id')::uuid,
  '11111111-1111-7111-8111-111111111111'::uuid,
  repeat('a', 650)
) as response;

select is(
  (select response->>'reschedule_request_id' from _rpc_request_twice),
  (select response->>'reschedule_request_id' from _rpc_request_once),
  'request RPC returns cached response for same idempotency key'
);

select is(
  (
    select count(*)::int
    from public.chat_messages m
    where m.chat_id = current_setting('test.rpc.main_chat_id')::uuid
      and m.idempotency_key = '11111111-1111-7111-8111-111111111111'::uuid
  ),
  1,
  'request RPC does not duplicate system message for idempotent retry'
);

select is(
  (
    select char_length(request_note)
    from public.service_reschedule_requests
    where id = (select (response->>'reschedule_request_id')::uuid from _rpc_request_once)
  ),
  500,
  'request RPC truncates request_note to database limit'
);

select throws_ok(
  format(
    $$ select public.cns_request_service_reschedule(%L::uuid, gen_random_uuid(), null) $$,
    current_setting('test.rpc.main_service_id')
  ),
  'P0001',
  'ACTIVE_RESCHEDULE_EXISTS',
  'request RPC rejects second active reschedule for same service'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.provider_id')::uuid);

select throws_ok(
  format(
    $sql$
      select public.cns_propose_service_reschedule(
        %L::uuid,
        jsonb_build_object('start_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'), 'shift', 'morning'),
        gen_random_uuid()
      )
    $sql$,
    current_setting('test.rpc.adjust_req_id')
  ),
  'P0001',
  'INVALID_RESCHEDULE_STATUS',
  'propose RPC rejects PROPOSED request state'
);

select throws_ok(
  format(
    $sql$
      select public.cns_cancel_service_reschedule_request(%L::uuid, gen_random_uuid())
    $sql$,
    current_setting('test.rpc.cancel_req_id')
  ),
  '42501',
  'FORBIDDEN',
  'provider cannot cancel a PROPOSED request'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.client_id')::uuid);

select throws_ok(
  format(
    $$ select public.cns_request_reschedule_adjustment(%L::uuid, gen_random_uuid()) $$,
    current_setting('test.rpc.adjust_req_id')
  ),
  'P0001',
  'ADJUSTMENT_LIMIT_REACHED',
  'adjustment RPC enforces max adjustment count'
);

create temp table _rpc_cancel as
select public.cns_cancel_service_reschedule_request(
  current_setting('test.rpc.cancel_req_id')::uuid,
  '22222222-2222-7222-8222-222222222222'::uuid
) as response;

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.rpc.cancel_req_id')::uuid
  ),
  'CANCELLED',
  'client can cancel a PROPOSED request'
);

select is(
  (
    select response->'reschedule'->>'active_request'
    from _rpc_cancel
  ),
  null,
  'cancel RPC response clears active request snapshot'
);

select throws_ok(
  format(
    $$ select public.cns_accept_service_reschedule(%L::uuid, gen_random_uuid()) $$,
    current_setting('test.rpc.cancel_req_id')
  ),
  'P0001',
  'INVALID_RESCHEDULE_STATUS',
  'accept RPC rejects cancelled request status'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.other_profile_id')::uuid);

select throws_ok(
  format(
    $sql$
      select public.cns_propose_service_reschedule(
        %L::uuid,
        jsonb_build_object('start_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'), 'shift', 'morning'),
        gen_random_uuid()
      )
    $sql$,
    (select response->>'reschedule_request_id' from _rpc_request_once)
  ),
  'P0002',
  'RESCHEDULE_REQUEST_NOT_FOUND',
  'propose RPC masks unauthorized request ids as not found'
);

select is(
  public.cns_get_service_reschedule_request(
    (select (response->>'reschedule_request_id')::uuid from _rpc_request_once)
  ),
  null,
  'detail RPC masks unauthorized access as null'
);

select pg_temp.service_reschedule_set_auth(current_setting('test.rpc.client_id')::uuid);

select ok(
  public.cns_get_service_reschedule_request(
    (select (response->>'reschedule_request_id')::uuid from _rpc_request_once)
  )->'active_request' is not null,
  'detail RPC returns snapshot for request participant'
);

select finish();

rollback;
