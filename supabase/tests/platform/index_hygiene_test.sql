-- pgTAP: index hygiene migration (20260706020000_drop_redundant_indexes_add_fk_indexes).

begin;

select plan(18);

-- Dropped redundant indexes
select ok(
  to_regclass('public.idx_platform_ai_prompts_prompt_key') is null,
  'idx_platform_ai_prompts_prompt_key dropped'
);

select ok(
  to_regclass('public.platform_states_abbreviation_idx') is null,
  'platform_states_abbreviation_idx dropped'
);

select ok(
  to_regclass('public.platform_states_ibge_code_idx') is null,
  'platform_states_ibge_code_idx dropped'
);

select ok(
  to_regclass('public.provider_profiles_public_slug_idx') is null,
  'provider_profiles_public_slug_idx dropped'
);

select ok(
  to_regclass('public.platform_cities_ibge_code_idx') is null,
  'platform_cities_ibge_code_idx dropped'
);

select ok(
  to_regclass('public.platform_cities_state_id_idx') is null,
  'platform_cities_state_id_idx dropped'
);

select ok(
  to_regclass('public.provider_proposals_pending_client_response_idx') is null,
  'provider_proposals_pending_client_response_idx dropped'
);

-- UNIQUE / partial indexes retained
select ok(
  to_regclass('public.platform_ai_prompts_prompt_key_key') is not null,
  'platform_ai_prompts_prompt_key_key retained'
);

select ok(
  to_regclass('public.provider_proposals_pending_sla_idx') is not null,
  'provider_proposals_pending_sla_idx retained'
);

-- New FK-supporting indexes
select ok(
  to_regclass('public.domain_events_service_request_id_idx') is not null,
  'domain_events_service_request_id_idx exists'
);

select ok(
  to_regclass('public.domain_events_chat_id_idx') is not null,
  'domain_events_chat_id_idx exists'
);

select ok(
  to_regclass('public.contracted_services_client_id_idx') is not null,
  'contracted_services_client_id_idx exists'
);

select ok(
  to_regclass('public.contracted_services_provider_id_idx') is not null,
  'contracted_services_provider_id_idx exists'
);

select ok(
  to_regclass('public.chat_messages_sender_user_id_idx') is not null,
  'chat_messages_sender_user_id_idx exists'
);

select ok(
  to_regclass('public.service_requests_address_id_idx') is not null,
  'service_requests_address_id_idx exists'
);

select ok(
  to_regclass('public.platform_ai_prompt_usage_user_id_idx') is not null,
  'platform_ai_prompt_usage_user_id_idx exists'
);

select ok(
  to_regclass('public.platform_ai_prompt_usage_request_id_idx') is not null,
  'platform_ai_prompt_usage_request_id_idx exists'
);

select ok(
  to_regclass('public.platform_services_form_id_idx') is not null,
  'platform_services_form_id_idx exists'
);

select finish();

rollback;
