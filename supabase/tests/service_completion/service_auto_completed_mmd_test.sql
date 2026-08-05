-- pgTAP: service-completion Task 42 — SERVICE_AUTO_COMPLETED MMD template + routing.

begin;

select plan(4);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.service_auto_completed'
      and mt.channel = 'push'
      and mt.active
      and mt.variable_schema ? 'properties'
      and mt.body_template ilike '%avaliar%'
  ),
  'service.service_auto_completed push template seeded with optional rating copy'
);

do $seed$
declare
  v_profile_id uuid;
begin
  select p.id
  into v_profile_id
  from public.profiles p
  limit 1;

  if v_profile_id is null then
    raise exception 'pgTAP requires at least one profiles row';
  end if;

  perform set_config('test.mmd.profile_id', v_profile_id::text, true);
end;
$seed$;

select is(
  public.mmd_ingest_event(
    'SERVICE_AUTO_COMPLETED',
    current_setting('test.mmd.profile_id')::uuid,
    'service_completion:pgtap-auto:auto_completed',
    jsonb_build_object(
      'service_id', gen_random_uuid()::text,
      'service_request_title', 'Serviço pgTAP',
      'optional_rating_cta', true,
      'completed_by', 'system',
      'deep_link_path', '/dashboard/services/pgtap'
    ),
    '{"recipient":"client","source":"service_completion_auto_complete_executed"}'::jsonb
  )->>'template_key',
  'service.service_auto_completed',
  'SERVICE_AUTO_COMPLETED routes to service.service_auto_completed'
);

select isnt(
  public.mmd_ingest_event(
    'SERVICE_AUTO_COMPLETED',
    current_setting('test.mmd.profile_id')::uuid,
    'service_completion:pgtap-auto-2:auto_completed',
    jsonb_build_object(
      'service_id', gen_random_uuid()::text,
      'service_request_title', 'Serviço pgTAP 2',
      'optional_rating_cta', true
    ),
    '{"recipient":"client"}'::jsonb
  )->>'reason',
  'unsupported_event_type',
  'SERVICE_AUTO_COMPLETED is not unsupported_event_type'
);

select ok(
  (
    select (public.mmd_ingest_event(
      'SERVICE_AUTO_COMPLETED',
      current_setting('test.mmd.profile_id')::uuid,
      'service_completion:pgtap-auto-3:auto_completed',
      jsonb_build_object(
        'service_id', gen_random_uuid()::text,
        'service_request_title', 'Serviço pgTAP 3',
        'optional_rating_cta', true
      ),
      '{"recipient":"client"}'::jsonb
    )->>'ingested_count')::int >= 1
  ),
  'SERVICE_AUTO_COMPLETED ingest enqueues at least one dispatch'
);

select * from finish();
rollback;
