-- pgTAP: service-completion Task 43 — SERVICE_EXECUTED / SERVICE_COMPLETED template extensions.

begin;

select plan(4);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.service_executed'
      and mt.channel = 'push'
      and mt.active
      and mt.body_template like '%executed_late_suffix%'
      and mt.body_template ilike '%confirm%'
      and mt.body_template ilike '%avali%'
      and (mt.variable_schema->'properties') ? 'executed_late'
      and (mt.variable_schema->'properties') ? 'deep_link_path'
  ),
  'service.service_executed includes late suffix + confirm/avaliate copy'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.service_completed'
      and mt.channel = 'push'
      and mt.active
      and mt.body_template ilike '%avalia%'
      and (mt.variable_schema->'properties') ? 'overall_score'
  ),
  'service.service_completed mentions rating for provider'
);

do $seed$
declare
  v_profile_id uuid;
begin
  select p.id into v_profile_id from public.profiles p limit 1;
  if v_profile_id is null then
    raise exception 'pgTAP requires at least one profiles row';
  end if;
  perform set_config('test.mmd.profile_id', v_profile_id::text, true);
end;
$seed$;

select is(
  public.mmd_ingest_event(
    'SERVICE_EXECUTED',
    current_setting('test.mmd.profile_id')::uuid,
    'service_completion:pgtap-executed:executed',
    jsonb_build_object(
      'service_id', gen_random_uuid()::text,
      'service_request_title', 'Serviço pgTAP',
      'executed_late', true,
      'executed_late_suffix', ' (após o prazo)',
      'deep_link_path', '/dashboard/services/pgtap'
    ),
    '{}'::jsonb
  )->>'template_key',
  'service.service_executed',
  'SERVICE_EXECUTED still routes to service.service_executed'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_COMPLETED',
    current_setting('test.mmd.profile_id')::uuid,
    'service_completion:pgtap-completed:completed_client',
    jsonb_build_object(
      'service_id', gen_random_uuid()::text,
      'service_request_title', 'Serviço pgTAP',
      'completed_by', 'client',
      'overall_score', 4.5
    ),
    '{"recipient":"provider"}'::jsonb
  )->>'template_key',
  'service.service_completed',
  'SERVICE_COMPLETED still routes to service.service_completed for provider'
);

select * from finish();
rollback;
