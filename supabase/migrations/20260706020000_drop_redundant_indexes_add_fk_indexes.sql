-- Index hygiene: drop duplicates superseded by UNIQUE constraints; add FK-supporting indexes.

-- ---------------------------------------------------------------------------
-- Redundant non-unique indexes (UNIQUE / composite indexes already cover lookups).
-- ---------------------------------------------------------------------------

drop index if exists public.idx_platform_ai_prompts_prompt_key;
drop index if exists public.platform_states_abbreviation_idx;
drop index if exists public.platform_states_ibge_code_idx;
drop index if exists public.provider_profiles_public_slug_idx;
drop index if exists public.platform_cities_ibge_code_idx;
drop index if exists public.platform_cities_state_id_idx;
drop index if exists public.provider_proposals_pending_client_response_idx;

-- ---------------------------------------------------------------------------
-- FK columns without supporting indexes (JOIN / CASCADE / DELETE on parent).
-- ---------------------------------------------------------------------------

create index if not exists domain_events_service_request_id_idx
  on public.domain_events (service_request_id)
  where service_request_id is not null;

create index if not exists domain_events_chat_id_idx
  on public.domain_events (chat_id)
  where chat_id is not null;

create index if not exists contracted_services_client_id_idx
  on public.contracted_services (client_id);

create index if not exists contracted_services_provider_id_idx
  on public.contracted_services (provider_id);

create index if not exists chat_messages_sender_user_id_idx
  on public.chat_messages (sender_user_id);

create index if not exists service_requests_address_id_idx
  on public.service_requests (address_id);

create index if not exists platform_ai_prompt_usage_user_id_idx
  on public.platform_ai_prompt_usage (user_id);

create index if not exists platform_ai_prompt_usage_request_id_idx
  on public.platform_ai_prompt_usage (request_id);

create index if not exists platform_services_form_id_idx
  on public.platform_services (form_id);

create index if not exists chat_read_receipts_last_read_message_id_idx
  on public.chat_read_receipts (last_read_message_id);

create index if not exists provider_portfolio_items_service_id_idx
  on public.provider_portfolio_items (service_id);
