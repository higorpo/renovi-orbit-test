-- pgTAP: service reschedule MMD catalog/routing and project_service_row payload.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(20);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_templates mt
    where mt.template_key in (
      'service.reschedule_requested',
      'service.reschedule_proposed',
      'service.reschedule_adjustment_requested',
      'service.reschedule_cancelled',
      'service.reschedule_accepted',
      'service.reschedule_accepted_provider',
      'service.reschedule_reminder'
    )
      and mt.active
  ),
  11,
  'all service reschedule MMD templates are registered across expected channels'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.reschedule_requested'
      and mt.channel = 'email'
      and mt.variable_schema ? 'required'
  ),
  'requested email template includes schema'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.reschedule_proposed'
      and mt.channel = 'push'
      and mt.body_template like '%{{proposed_execution_formatted}}%'
  ),
  'proposed push template includes proposed date variable'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.reschedule_accepted_provider'
      and mt.channel = 'email'
      and mt.active
  ),
  'accepted provider email template is registered'
);

do $seed$
declare
  v_profile_id uuid;
  v_service_id uuid := gen_random_uuid();
  v_fixture record;
  v_req_id uuid;
begin
  select p.id
  into v_profile_id
  from public.profiles p
  limit 1;

  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(v_service_id);

  v_req_id := pg_temp.service_reschedule_insert_request(
    v_service_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );

  perform set_config('test.mmd.profile_id', v_profile_id::text, true);
  perform set_config('test.project.service_request_id', v_fixture.service_request_id::text, true);
  perform set_config('test.project.client_id', v_fixture.client_id::text, true);
  perform set_config('test.project.req_id', v_req_id::text, true);
end;
$seed$;

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_REQUESTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-requested',
    jsonb_build_object('service_request_title', 'Teste', 'deep_link_path', '/dashboard/chats/x'),
    '{}'::jsonb
  )->>'template_key',
  'service.reschedule_requested',
  'SERVICE_RESCHEDULE_REQUESTED routes to requested template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_PROPOSED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-proposed',
    jsonb_build_object(
      'service_request_title', 'Teste',
      'proposed_execution_formatted', '10/08/2026 (Manhã)',
      'deep_link_path', '/dashboard/chats/x'
    ),
    '{}'::jsonb
  )->>'template_key',
  'service.reschedule_proposed',
  'SERVICE_RESCHEDULE_PROPOSED routes to proposed template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ADJUSTMENT_REQUESTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-adjustment',
    jsonb_build_object('service_request_title', 'Teste', 'deep_link_path', '/dashboard/chats/x'),
    '{}'::jsonb
  )->>'template_key',
  'service.reschedule_adjustment_requested',
  'SERVICE_RESCHEDULE_ADJUSTMENT_REQUESTED routes to adjustment template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_CANCELLED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-cancelled',
    jsonb_build_object('service_request_title', 'Teste', 'deep_link_path', '/dashboard/chats/x'),
    '{}'::jsonb
  )->>'template_key',
  'service.reschedule_cancelled',
  'SERVICE_RESCHEDULE_CANCELLED routes to cancelled template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ACCEPTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-accepted-client',
    jsonb_build_object(
      'service_request_title', 'Teste',
      'proposed_execution_formatted', '10/08/2026 (Manhã)',
      'deep_link_path', '/dashboard/services/x'
    ),
    '{"recipient":"client"}'::jsonb
  )->>'template_key',
  'service.reschedule_accepted',
  'SERVICE_RESCHEDULE_ACCEPTED client audience routes to client template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_ACCEPTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-accepted-provider',
    jsonb_build_object(
      'service_request_title', 'Teste',
      'proposed_execution_formatted', '10/08/2026 (Manhã)',
      'deep_link_path', '/dashboard/services/x'
    ),
    '{"recipient":"provider"}'::jsonb
  )->>'template_key',
  'service.reschedule_accepted_provider',
  'SERVICE_RESCHEDULE_ACCEPTED provider audience routes to provider template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_RESCHEDULE_REMINDER',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-reschedule-reminder',
    jsonb_build_object('service_request_title', 'Teste', 'deep_link_path', '/dashboard/chats/x'),
    '{}'::jsonb
  )->>'template_key',
  'service.reschedule_reminder',
  'SERVICE_RESCHEDULE_REMINDER routes to reminder template'
);

select is(
  (
    public.mmd_ingest_event(
      'SERVICE_RESCHEDULE_REMINDER',
      current_setting('test.mmd.profile_id')::uuid,
      'pgtap-service-reschedule-reminder:push',
      jsonb_build_object('service_request_title', 'Teste', 'deep_link_path', '/dashboard/chats/x'),
      '{}'::jsonb
    )->'dispatches'->0->>'channel'
  ),
  'push',
  'mmd_ingest_event keeps channel-suffixed idempotency keys valid'
);

create temp table _project_row as
select public.project_service_row(
  current_setting('test.project.service_request_id')::uuid,
  current_setting('test.project.client_id')::uuid
) as row_json;

select is(
  (select row_json->'contracted'->'reschedule'->'active_request'->>'id' from _project_row),
  current_setting('test.project.req_id'),
  'project_service_row exposes active reschedule request id'
);

select is(
  (select row_json->'contracted'->'reschedule'->>'can_cancel_reschedule' from _project_row),
  'true',
  'project_service_row reschedule snapshot exposes action flags'
);

select is(
  (select row_json->'contracted'->'reschedule'->'active_request'->>'status' from _project_row),
  'REQUESTED',
  'project_service_row reschedule snapshot preserves request status'
);

select is(
  (select row_json->'contracted'->'reschedule'->'active_request'->>'chat_id' from _project_row),
  (
    select c.id::text
    from public.service_reschedule_requests srr
    join public.chats c on c.id = srr.chat_id
    where srr.id = current_setting('test.project.req_id')::uuid
  ),
  'project_service_row reschedule snapshot includes chat id'
);

select isnt(
  (select row_json->'contracted'->'reschedule'->>'display_status' from _project_row),
  null,
  'project_service_row reschedule snapshot includes display status'
);

select ok(
  (select row_json->'contracted' ? 'chat_id' from _project_row),
  'project_service_row preserves existing contracted chat_id'
);

select ok(
  (select row_json->'request'->'address' ? 'latitude' from _project_row),
  'project_service_row preserves full-address coordinates for client'
);

select ok(
  (select row_json->'contracted'->'provider' ? 'display_name' from _project_row),
  'project_service_row preserves contracted provider summary'
);

select finish();

rollback;
