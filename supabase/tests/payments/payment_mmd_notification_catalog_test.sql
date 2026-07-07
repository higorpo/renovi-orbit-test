-- pgTAP: payment Task 109 — MMD payment notification catalog and routing.

begin;

select plan(17);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'payment.upcoming_charge'
      and mt.channel = 'push'
      and mt.active
  ),
  'payment.upcoming_charge push template registered'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'payment.charge_succeeded'
      and mt.channel = 'email'
      and mt.active
  ),
  'payment.charge_succeeded email template registered'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'payment.charge_failed_permanent_provider'
      and mt.channel = 'push'
      and mt.active
  ),
  'payment.charge_failed_permanent_provider template registered'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'payment.transaction_dispute'
      and mt.channel = 'push'
      and mt.active
  ),
  'payment.transaction_dispute template registered'
);

do $seed$
declare
  v_profile_id uuid;
begin
  select p.id
  into v_profile_id
  from public.profiles p
  limit 1;

  perform set_config('test.mmd.profile_id', v_profile_id::text, true);
end;
$seed$;

select is(
  public.mmd_ingest_event(
    'UPCOMING_CHARGE',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-upcoming-charge',
    jsonb_build_object('contracted_service_id', gen_random_uuid()::text),
    '{"recipient":"client"}'::jsonb
  )->>'template_key',
  'payment.upcoming_charge',
  'UPCOMING_CHARGE routes to payment.upcoming_charge'
);

select is(
  public.mmd_ingest_event(
    'CHARGE_SUCCEEDED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-charge-succeeded-provider',
    jsonb_build_object('contracted_service_id', gen_random_uuid()::text),
    '{"recipient":"provider"}'::jsonb
  )->>'template_key',
  'payment.charge_succeeded_provider',
  'CHARGE_SUCCEEDED provider audience uses provider template'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_EXECUTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-service-executed',
    jsonb_build_object('service_id', gen_random_uuid()::text),
    '{}'::jsonb
  )->>'template_key',
  'service.service_executed',
  'SERVICE_EXECUTED routes to service.service_executed'
);

select is(
  coalesce(
    public.mmd_ingest_event(
      'UNKNOWN_PAYMENT_EVENT',
      current_setting('test.mmd.profile_id')::uuid,
      'pgtap-unknown',
      '{}'::jsonb,
      '{}'::jsonb
    )->>'skipped',
    'true'
  ),
  'true',
  'unknown event types remain skipped'
);

select is(
  public.mmd_ingest_event(
    'PROVIDER_SUSPENDED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-provider-suspended-provider',
    jsonb_build_object('provider_id', gen_random_uuid()::text),
    '{"recipient":"provider"}'::jsonb
  )->>'template_key',
  'account.provider_suspended',
  'PROVIDER_SUSPENDED provider audience uses account.provider_suspended'
);

select is(
  public.mmd_ingest_event(
    'PROVIDER_SUSPENDED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-provider-suspended-client',
    jsonb_build_object(
      'contracted_service_id', gen_random_uuid()::text,
      'service_request_title', 'Teste'
    ),
    '{"recipient":"client"}'::jsonb
  )->>'template_key',
  'payment.provider_suspended_client',
  'PROVIDER_SUSPENDED client audience uses payment.provider_suspended_client'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'payment.provider_suspended_client'
      and mt.channel = 'push'
      and mt.active
  ),
  'payment.provider_suspended_client push template registered'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_AUTO_CANCELLED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-auto-cancel-non-payment',
    jsonb_build_object(
      'contracted_service_id', gen_random_uuid()::text,
      'service_request_title', 'Teste'
    ),
    '{"recipient":"client","cancellation_reason":"NON_PAYMENT"}'::jsonb
  )->>'template_key',
  'payment.service_auto_cancelled',
  'SERVICE_AUTO_CANCELLED NON_PAYMENT client uses payment.service_auto_cancelled'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_AUTO_CANCELLED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-auto-cancel-provider-suspended',
    jsonb_build_object(
      'contracted_service_id', gen_random_uuid()::text,
      'service_request_title', 'Teste'
    ),
    '{"recipient":"client","cancellation_reason":"PROVIDER_SUSPENDED"}'::jsonb
  )->>'template_key',
  'payment.service_auto_cancelled_suspended',
  'SERVICE_AUTO_CANCELLED PROVIDER_SUSPENDED client uses suspended template'
);

select is(
  public.mmd_ingest_event(
    'PROVIDER_KYC_SUBMITTED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-provider-kyc-submitted',
    jsonb_build_object(
      'provider_id', current_setting('test.mmd.profile_id'),
      'deep_link_path', '/dashboard'
    ),
    '{"source":"dispatch-kyc-email"}'::jsonb
  )->>'template_key',
  'account.provider_kyc_submitted',
  'PROVIDER_KYC_SUBMITTED routes to account.provider_kyc_submitted'
);

select is(
  public.mmd_ingest_event(
    'SERVICE_AUTO_CANCELLED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-auto-cancel-provider-suspended-provider',
    jsonb_build_object(
      'contracted_service_id', gen_random_uuid()::text,
      'service_request_title', 'Teste'
    ),
    '{"recipient":"provider","cancellation_reason":"PROVIDER_SUSPENDED"}'::jsonb
  )->>'template_key',
  'payment.service_auto_cancelled_suspended_provider',
  'SERVICE_AUTO_CANCELLED PROVIDER_SUSPENDED provider uses suspended provider template'
);

select is(
  public.mmd_ingest_event(
    'PROVIDER_ACTIVATED',
    current_setting('test.mmd.profile_id')::uuid,
    'pgtap-provider-activated',
    jsonb_build_object(
      'provider_id', current_setting('test.mmd.profile_id'),
      'provider_gateway_account_id', gen_random_uuid()::text,
      'deep_link_path', '/dashboard'
    ),
    '{"source":"payment_activate_provider_from_netcred"}'::jsonb
  )->>'template_key',
  'account.provider_activated',
  'PROVIDER_ACTIVATED routes to account.provider_activated'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'account.provider_activated'
      and mt.channel = 'email'
      and mt.active
  ),
  'account.provider_activated email template registered'
);

select * from finish();
rollback;
