-- pgTAP: inventory of every RLS policy in public, storage, and message_dispatcher.
-- Fails if a policy is renamed/dropped without updating this manifest.

begin;

select plan(2);

create temp table _expected_policies (schemaname text, tablename text, policyname text);

insert into _expected_policies (schemaname, tablename, policyname) values
    -- message_dispatcher
    ('message_dispatcher', 'message_dispatch_deliveries', 'message_dispatch_deliveries_select_owner'),
    ('message_dispatcher', 'message_dispatch_engagements', 'message_dispatch_engagements_select_owner'),
    ('message_dispatcher', 'message_dispatcher_audit', 'message_dispatcher_audit_select_owner'),
    ('message_dispatcher', 'message_dispatcher_user_limits', 'message_dispatcher_user_limits_select_owner'),
    ('message_dispatcher', 'message_dispatches', 'message_dispatches_select_owner'),
    -- public — chat / CNS
    ('public', 'chat_audit', 'chat_audit_admin_select'),
    ('public', 'chat_messages', 'chat_messages_delete_denied'),
    ('public', 'chat_messages', 'chat_messages_insert_denied'),
    ('public', 'chat_messages', 'chat_messages_select'),
    ('public', 'chat_messages', 'chat_messages_update_denied'),
    ('public', 'chat_read_receipts', 'chat_read_receipts_delete_denied'),
    ('public', 'chat_read_receipts', 'chat_read_receipts_insert_denied'),
    ('public', 'chat_read_receipts', 'chat_read_receipts_select'),
    ('public', 'chat_read_receipts', 'chat_read_receipts_update_denied'),
    ('public', 'chats', 'chats_delete_denied'),
    ('public', 'chats', 'chats_insert_denied'),
    ('public', 'chats', 'chats_select'),
    ('public', 'chats', 'chats_update_denied'),
    ('public', 'contracted_services', 'contracted_services_delete_denied'),
    ('public', 'contracted_services', 'contracted_services_insert_denied'),
    ('public', 'contracted_services', 'contracted_services_select'),
    ('public', 'contracted_services', 'contracted_services_update_denied'),
    ('public', 'provider_proposals', 'provider_proposals_delete_denied'),
    ('public', 'provider_proposals', 'provider_proposals_insert_denied'),
    ('public', 'provider_proposals', 'provider_proposals_select'),
    ('public', 'provider_proposals', 'provider_proposals_update_denied'),
    -- public — profiles / addresses
    ('public', 'profiles', 'profiles_insert'),
    ('public', 'profiles', 'profiles_select'),
    ('public', 'profiles', 'profiles_update'),
    ('public', 'client_addresses', 'client_addresses_insert'),
    ('public', 'client_addresses', 'client_addresses_select'),
    ('public', 'client_addresses', 'client_addresses_update'),
    ('public', 'client_profiles_private', 'client_profiles_private_insert'),
    ('public', 'client_profiles_private', 'client_profiles_private_select'),
    ('public', 'client_profiles_private', 'client_profiles_private_update'),
    ('public', 'provider_profiles_private', 'provider_profiles_private_insert'),
    ('public', 'provider_profiles_private', 'provider_profiles_private_select'),
    ('public', 'provider_profiles_private', 'provider_profiles_private_update'),
    ('public', 'provider_profiles_public', 'provider_profiles_public_insert'),
    ('public', 'provider_profiles_public', 'provider_profiles_public_select'),
    ('public', 'provider_profiles_public', 'provider_profiles_public_update'),
    ('public', 'provider_offered_services', 'provider_offered_services_delete'),
    ('public', 'provider_offered_services', 'provider_offered_services_insert'),
    ('public', 'provider_offered_services', 'provider_offered_services_select'),
    ('public', 'provider_offered_services', 'provider_offered_services_update'),
    ('public', 'provider_portfolio_items', 'provider_portfolio_items_delete'),
    ('public', 'provider_portfolio_items', 'provider_portfolio_items_insert'),
    ('public', 'provider_portfolio_items', 'provider_portfolio_items_select'),
    ('public', 'provider_portfolio_items', 'provider_portfolio_items_update'),
    ('public', 'provider_service_area_neighborhoods', 'provider_service_area_neighborhoods_delete'),
    ('public', 'provider_service_area_neighborhoods', 'provider_service_area_neighborhoods_insert'),
    ('public', 'provider_service_area_neighborhoods', 'provider_service_area_neighborhoods_select'),
    ('public', 'user_device_beacons', 'user_device_beacons_all'),
    -- public — service requests / operational
    ('public', 'service_requests', 'service_requests_insert'),
    ('public', 'service_requests', 'service_requests_select'),
    ('public', 'service_requests', 'service_requests_update'),
    ('public', 'domain_events', 'domain_events_admin_select'),
    ('public', 'job_runs', 'job_runs_admin_select'),
    ('public', 'rpc_idempotency_records', 'rpc_idempotency_records_admin_select'),
    ('public', 'proposal_audit', 'proposal_audit_admin_select'),
    -- public — platform catalogs
    ('public', 'platform_cities', 'platform_cities_delete'),
    ('public', 'platform_cities', 'platform_cities_insert'),
    ('public', 'platform_cities', 'platform_cities_select'),
    ('public', 'platform_cities', 'platform_cities_update'),
    ('public', 'platform_states', 'platform_states_delete'),
    ('public', 'platform_states', 'platform_states_insert'),
    ('public', 'platform_states', 'platform_states_select'),
    ('public', 'platform_states', 'platform_states_update'),
    ('public', 'platform_neighborhoods', 'platform_neighborhoods_delete'),
    ('public', 'platform_neighborhoods', 'platform_neighborhoods_insert'),
    ('public', 'platform_neighborhoods', 'platform_neighborhoods_select'),
    ('public', 'platform_neighborhoods', 'platform_neighborhoods_update'),
    ('public', 'platform_services', 'platform_services_delete'),
    ('public', 'platform_services', 'platform_services_insert'),
    ('public', 'platform_services', 'platform_services_select'),
    ('public', 'platform_services', 'platform_services_update'),
    ('public', 'platform_forms', 'platform_forms_delete'),
    ('public', 'platform_forms', 'platform_forms_insert'),
    ('public', 'platform_forms', 'platform_forms_select'),
    ('public', 'platform_forms', 'platform_forms_update'),
    ('public', 'platform_constants', 'platform_constants_all'),
    ('public', 'platform_ai_prompts', 'platform_ai_prompts_insert'),
    ('public', 'platform_ai_prompts', 'platform_ai_prompts_select'),
    ('public', 'platform_ai_prompts', 'platform_ai_prompts_update'),
    ('public', 'platform_ai_prompt_usage', 'platform_ai_prompt_usage_select'),
    -- storage.objects (chat-media *_denied dropped: OR-permissive hole; default deny)
    ('storage', 'objects', 'storage_objects_chat_media_select'),
    ('storage', 'objects', 'storage_objects_portfolio_images_delete'),
    ('storage', 'objects', 'storage_objects_portfolio_images_insert'),
    ('storage', 'objects', 'storage_objects_portfolio_images_select'),
    ('storage', 'objects', 'storage_objects_portfolio_images_update'),
    ('storage', 'objects', 'storage_objects_profile_images_delete'),
    ('storage', 'objects', 'storage_objects_profile_images_insert'),
    ('storage', 'objects', 'storage_objects_profile_images_select_authenticated'),
    ('storage', 'objects', 'storage_objects_profile_images_update'),
    ('storage', 'objects', 'storage_objects_proposal_images_delete'),
    ('storage', 'objects', 'storage_objects_proposal_images_insert'),
    ('storage', 'objects', 'storage_objects_proposal_images_select'),
    ('storage', 'objects', 'storage_objects_proposal_images_update'),
    ('storage', 'objects', 'storage_objects_service_requests_select');

select is(
  (select count(*)::int from _expected_policies),
  99,
  'expected policy manifest has 99 entries'
);

select is(
  (
    select count(*)::int
    from _expected_policies e
    left join pg_policies p
      on p.schemaname = e.schemaname
     and p.tablename = e.tablename
     and p.policyname = e.policyname
    where p.policyname is null
  ),
  0,
  'every manifest policy exists in pg_policies (no missing policies)'
);

select finish();

rollback;
