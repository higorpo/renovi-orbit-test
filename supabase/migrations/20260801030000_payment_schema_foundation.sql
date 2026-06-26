-- Payment Task 5: subsystem schema foundation (design.md §2.3, §3).
-- Normative enum types for payment FSM vocabulary — same pattern as CNS (create_cns_enums).
-- Table CREATE migrations (Tasks 6–14) MUST use these types on state/status columns.

-- ---------------------------------------------------------------------------
-- Gateway slug (Option A — single provider MVP, design.md §3.1)
-- ---------------------------------------------------------------------------

create type public.payment_gateway_slug as enum ('netcred');

comment on type public.payment_gateway_slug is
  'MVP payment gateway identifier; extend enum when adding providers.';

-- ---------------------------------------------------------------------------
-- Payment schedule state machine (design.md §2.3, §3.5)
-- ---------------------------------------------------------------------------

create type public.payment_schedule_state as enum (
  'SCHEDULED',
  'PROCESSING',
  'PAID',
  'IN_ANALYSIS',
  'FAILED',
  'FAILED_PERMANENT',
  'CANCELLED',
  'VOIDED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'EXPIRED'
);

comment on type public.payment_schedule_state is
  'Authoritative payment_schedules.state vocabulary (12-state machine including EXPIRED terminal).';

-- ---------------------------------------------------------------------------
-- Client card token lifecycle (design.md §3.3)
-- ---------------------------------------------------------------------------

create type public.payment_client_card_token_state as enum (
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'TOKENIZATION_FAILED'
);

comment on type public.payment_client_card_token_state is
  'client_card_tokens.state vocabulary; no raw PAN/CVV columns at rest.';

-- ---------------------------------------------------------------------------
-- Provider credentialing FSM (design.md §2.3, §3.4)
-- ---------------------------------------------------------------------------

create type public.payment_provider_onboarding_status as enum (
  'PENDING_DOCUMENTS',
  'DOCUMENTS_SUBMITTED',
  'UNDER_NETCRED_REVIEW',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED'
);

comment on type public.payment_provider_onboarding_status is
  'provider_gateway_accounts.onboarding_status vocabulary.';

-- ---------------------------------------------------------------------------
-- Charge attempt diagnostics (design.md §3.6)
-- ---------------------------------------------------------------------------

create type public.payment_attempt_initiator as enum ('cron', 'client');

create type public.payment_attempt_outcome as enum (
  'PAID',
  'REJECTED',
  'TIMEOUT',
  'ERROR',
  'IN_ANALYSIS',
  'VOIDED'
);

comment on type public.payment_attempt_initiator is
  'payment_attempts.initiator vocabulary.';

comment on type public.payment_attempt_outcome is
  'payment_attempts.outcome vocabulary; NULL while attempt is in flight.';

-- ---------------------------------------------------------------------------
-- Webhook ingestion and async queue (design.md §3.7, §3.8)
-- ---------------------------------------------------------------------------

create type public.payment_webhook_event_state as enum (
  'RECEIVED',
  'VALIDATING',
  'PROCESSING',
  'PROCESSED',
  'DUPLICATE',
  'FAILED',
  'DEAD_LETTER'
);

create type public.payment_webhook_queue_state as enum (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED'
);

comment on type public.payment_webhook_event_state is
  'payment_webhook_events.state vocabulary including dead-letter path.';

comment on type public.payment_webhook_queue_state is
  'payment_webhook_processing_queue.state vocabulary.';

-- ---------------------------------------------------------------------------
-- Audit and domain-event actors (design.md §3.9, §3.10)
-- ---------------------------------------------------------------------------

create type public.payment_audit_actor as enum (
  'cron',
  'client',
  'webhook',
  'support',
  'system'
);

comment on type public.payment_audit_actor is
  'payment_audit_log.actor vocabulary.';

-- Entity / aggregate type literals (TEXT columns — documented for Tasks 6–14):
--   payment_audit_log.entity_type: payment_schedule, client_card_token, provider_gateway_account
--   payment_events.aggregate_type: payment_schedule, client_card_token, provider_gateway_account
--   payment_audit_log.from_state / to_state: free-text transition labels (may differ by entity)

-- ---------------------------------------------------------------------------
-- Shared append-only enforcement for payment log tables
-- ---------------------------------------------------------------------------

create or replace function public.payment_deny_row_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'PAYMENT_APPEND_ONLY_TABLE'
    using
      errcode = 'P0001',
      detail = jsonb_build_object(
        'code', 'PAYMENT_APPEND_ONLY_TABLE',
        'table', tg_table_name
      )::text;
end;
$$;

comment on function public.payment_deny_row_mutation() is
  'Trigger helper: blocks UPDATE/DELETE on append-only payment tables.';
