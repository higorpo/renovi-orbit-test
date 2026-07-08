-- pgTAP: service reschedule schema invariants, helper functions, and triggers.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(27);

select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'service_reschedule_request_status'
      and e.enumlabel in (
        'REQUESTED', 'PROPOSED', 'ADJUSTMENT_REQUESTED',
        'ACCEPTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'
      )
    group by t.oid
    having count(*) = 7
  ),
  'service_reschedule_request_status enum has all FSM labels'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'service_reschedule_requests'
      and i.indexname = 'service_reschedule_requests_one_active_per_service_idx'
      and i.indexdef like '%WHERE (status = ANY%'
  ),
  'active request uniqueness partial index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'service_reschedule_requests'
      and i.indexname = 'service_reschedule_requests_active_created_idx'
      and i.indexdef like '%created_at%'
  ),
  'active created_at partial index exists'
);

select is(
  (
    select count(*)::int
    from public.platform_constants pc
    where pc.key like 'service_reschedule.%'
  ),
  8,
  'all service_reschedule platform constants are seeded'
);

select ok(
  not has_table_privilege('authenticated', 'public.service_reschedule_requests', 'INSERT')
    and has_table_privilege('service_role', 'public.service_reschedule_requests', 'INSERT'),
  'service_reschedule_requests table writes are RPC/service_role only'
);

select is(public.cns_format_reschedule_shift_pt('morning'), 'Manhã', 'formats morning shift');
select is(public.cns_format_reschedule_shift_pt('full_day'), 'Dia inteiro', 'formats full_day shift');
select is(public.cns_format_reschedule_shift_pt('night'), 'night', 'passes unknown shift through');

select is(public.cns_format_reschedule_slot_pt(null), '', 'null slot formats as empty string');
select is(public.cns_format_reschedule_slot_pt('[]'::jsonb), '', 'non-object slot formats as empty string');

select ok(
  position(
    'até' in public.cns_format_reschedule_slot_pt(
      jsonb_build_object('start_date', '2026-08-10', 'end_date', '2026-08-12', 'shift', 'afternoon')
    )
  ) > 0,
  'date range slot includes range separator'
);

select lives_ok(
  $$ select public._cns_validate_reschedule_slot(
    jsonb_build_object('start_date', to_char(public.cns_business_today() + 2, 'YYYY-MM-DD'), 'shift', 'morning')
  ) $$,
  'valid reschedule slot passes validation'
);

select throws_ok(
  $$ select public._cns_validate_reschedule_slot(null) $$,
  '22023',
  'INVALID_SLOT_SHAPE',
  'slot validator rejects null slot'
);

select throws_ok(
  $$ select public._cns_validate_reschedule_slot(jsonb_build_object('start_date', '2026-08-10', 'shift', 'night')) $$,
  '22023',
  'INVALID_SLOT_SHIFT',
  'slot validator rejects invalid shift'
);

select throws_ok(
  $$ select public._cns_validate_reschedule_slot(jsonb_build_object('start_date', 'not-a-date', 'shift', 'morning')) $$,
  '22023',
  'INVALID_SLOT_START_DATE',
  'slot validator rejects invalid start date'
);

select throws_ok(
  $$ select public._cns_validate_reschedule_slot(jsonb_build_object('start_date', '2026-08-10', 'end_date', '2026-08-09', 'shift', 'morning')) $$,
  '22023',
  'INVALID_SLOT_END_DATE',
  'slot validator rejects end date before start date'
);

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

  perform set_config('test.schema.service_id', v_service_id::text, true);
  perform set_config('test.schema.other_service_id', v_other_service_id::text, true);
  perform set_config('test.schema.other_chat_id', v_other_fixture.chat_id::text, true);
  perform set_config('test.schema.other_client_id', v_other_fixture.client_id::text, true);
  perform set_config('test.schema.client_id', v_fixture.client_id::text, true);
  perform set_config('test.schema.provider_id', v_fixture.provider_id::text, true);
  perform set_config('test.schema.chat_id', v_fixture.chat_id::text, true);
  perform set_config('test.schema.req_id', v_req_id::text, true);
end;
$seed$;

select is(
  public.cns_resolve_contracted_service_chat_id(current_setting('test.schema.service_id')::uuid),
  current_setting('test.schema.chat_id')::uuid,
  'resolves contracted service chat id'
);

select throws_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id, chat_id, requested_by_role, requested_by_profile_id,
        original_slot, original_service_execution_at, idempotency_key
      )
      values (
        %L::uuid, %L::uuid, 'client', %L::uuid,
        jsonb_build_object('start_date', '2026-08-10', 'shift', 'morning'),
        now() + interval '10 days',
        gen_random_uuid()
      )
    $sql$,
    current_setting('test.schema.service_id'),
    current_setting('test.schema.other_chat_id'),
    current_setting('test.schema.client_id')
  ),
  '23514',
  'CHAT_CONTRACTED_SERVICE_MISMATCH',
  'chat consistency trigger rejects unrelated chat'
);

select throws_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id, chat_id, requested_by_role, requested_by_profile_id,
        original_slot, original_service_execution_at, idempotency_key
      )
      values (
        %L::uuid, %L::uuid, 'client', %L::uuid,
        jsonb_build_object('start_date', '2026-08-10', 'shift', 'morning'),
        now() + interval '10 days',
        gen_random_uuid()
      )
    $sql$,
    current_setting('test.schema.service_id'),
    current_setting('test.schema.chat_id'),
    current_setting('test.schema.provider_id')
  ),
  '23514',
  'REQUESTER_PROFILE_MISMATCH',
  'requester consistency trigger rejects mismatched requester'
);

select throws_ok(
  format(
    $sql$
      insert into public.service_reschedule_requests (
        contracted_service_id, chat_id, status, requested_by_role, requested_by_profile_id,
        original_slot, original_service_execution_at, proposed_slot, proposed_at, idempotency_key
      )
      values (
        %L::uuid, %L::uuid, 'PROPOSED', 'client', %L::uuid,
        jsonb_build_object('start_date', '2026-08-10', 'shift', 'morning'),
        now() + interval '10 days',
        jsonb_build_object('start_date', '2026-08-12', 'shift', 'morning'),
        now(),
        gen_random_uuid()
      )
    $sql$,
    current_setting('test.schema.other_service_id'),
    current_setting('test.schema.other_chat_id'),
    current_setting('test.schema.other_client_id')
  ),
  '23514',
  'INVALID_INITIAL_STATUS',
  'FSM trigger rejects non-REQUESTED initial status'
);

select throws_ok(
  format(
    $$ update public.service_reschedule_requests set status = 'ACCEPTED' where id = %L::uuid $$,
    current_setting('test.schema.req_id')
  ),
  '23514',
  'INVALID_RESCHEDULE_STATUS_TRANSITION',
  'FSM trigger rejects REQUESTED to ACCEPTED transition'
);

select lives_ok(
  format(
    $$ update public.service_reschedule_requests set status = 'CANCELLED' where id = %L::uuid $$,
    current_setting('test.schema.req_id')
  ),
  'FSM allows REQUESTED to CANCELLED transition'
);

select throws_ok(
  format(
    $$ update public.service_reschedule_requests set request_note = 'mutate terminal' where id = %L::uuid $$,
    current_setting('test.schema.req_id')
  ),
  '23514',
  'TERMINAL_ROW_IMMUTABLE',
  'terminal row immutable trigger rejects non-status mutation'
);

select is(
  public.cns_cancel_active_service_reschedule_requests(current_setting('test.schema.service_id')::uuid),
  0,
  'cancel active helper ignores terminal requests'
);

do $seed_active$
declare
  v_req_id uuid;
begin
  v_req_id := pg_temp.service_reschedule_insert_request(
    current_setting('test.schema.service_id')::uuid,
    current_setting('test.schema.chat_id')::uuid,
    'provider'::public.service_reschedule_requested_by_role,
    current_setting('test.schema.provider_id')::uuid
  );
  perform set_config('test.schema.active_req_id', v_req_id::text, true);
end;
$seed_active$;

select is(
  public.cns_cancel_active_service_reschedule_requests(current_setting('test.schema.service_id')::uuid),
  1,
  'cancel active helper cancels one active request'
);

select is(
  (
    select status::text
    from public.service_reschedule_requests
    where id = current_setting('test.schema.active_req_id')::uuid
  ),
  'CANCELLED',
  'cancel active helper moves active request to CANCELLED'
);

select ok(
  has_function_privilege('service_role', 'public._cns_apply_service_reschedule_slot(uuid,jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public._cns_apply_service_reschedule_slot(uuid,jsonb)', 'EXECUTE'),
  'internal apply-slot helper is service_role only'
);

select finish();

rollback;
