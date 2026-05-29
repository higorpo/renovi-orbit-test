-- CNS Wave A — task 1: normative enum types (design §3.1, platform-flow.mmd).
-- First CNS migration; no tables or RLS in this file.

-- Conversation FSM: ACTIVE ↔ INACTIVE (reciprocity) → CLOSED (manual, accept elsewhere, SR cancel).
create type public.cns_conversation_status as enum ('ACTIVE', 'INACTIVE', 'CLOSED');

comment on type public.cns_conversation_status is
  'Chat lifecycle per platform-flow.mmd. ACTIVE: bilateral discovery; INACTIVE: slot released (no reciprocity); CLOSED: terminal.';

create type public.cns_closure_type as enum (
  'MANUAL',
  'PROPOSAL_ACCEPTED_ELSEWHERE',
  'SERVICE_REQUEST_CANCELLED'
);

comment on type public.cns_closure_type is
  'Why a conversation reached CLOSED. PROPOSAL_ACCEPTED_ELSEWHERE: accept cascade on another chat.';

create type public.cns_inactivation_reason as enum ('NO_RECIPROCITY');

comment on type public.cns_inactivation_reason is
  'Reason for ACTIVE → INACTIVE (24h reciprocity window, platform-flow.mmd node I).';

create type public.cns_message_type as enum (
  'TEXT',
  'IMAGE',
  'SYSTEM',
  'PROPOSAL',
  'WORKFLOW_ACTION'
);

comment on type public.cns_message_type is
  'chat_messages.content kind. WORKFLOW_ACTION: structured FSM side-effects (Req. 3, 16).';

create type public.cns_delivery_status as enum (
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

comment on type public.cns_delivery_status is
  'Per-message delivery/read pipeline for client UX; not the negotiation FSM.';

-- Proposal FSM: PENDING → ACCEPTED | REJECTED | EXPIRED | REVISION_REQUESTED → REVISED | REJECTED_AUTOMATICALLY.
create type public.proposal_status as enum (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'REVISION_REQUESTED',
  'REVISED',
  'REJECTED_AUTOMATICALLY'
);

comment on type public.proposal_status is
  'Provider proposal lifecycle per platform-flow.mmd (nodes M–T, U, X, Z).';

create type public.proposal_revision_reason as enum (
  'PRICE_TOO_HIGH',
  'REDUCE_SCOPE',
  'DATE_NOT_AVAILABLE',
  'CHANGE_TIMELINE',
  'CLARIFY_DETAILS',
  'OTHER'
);

comment on type public.proposal_revision_reason is
  'Client revision request taxonomy when moving proposal to REVISION_REQUESTED.';

-- Service request domain (CNS migration of service_requests.status in task 13).
create type public.service_request_status as enum ('OPEN', 'COMPLETED', 'CANCELLED');

comment on type public.service_request_status is
  'SR negotiation lifecycle: OPEN until accept (COMPLETED) or cancel (CANCELLED).';

-- Post-accept contracted service (extends when payments ship).
create type public.contracted_service_status as enum ('PENDING_PAYMENT');

comment on type public.contracted_service_status is
  'services.status after accept cascade (platform-flow.mmd node BA). Extend for payment FSM later.';

/*
 * Legacy provider_proposals.status → proposal_status (Wave C column migration).
 * Applied when provider_proposals.status migrates from text CHECK to proposal_status.
 *
 *   submitted  → PENDING
 *   accepted   → ACCEPTED
 *   rejected   → REJECTED
 *   withdrawn  → REVISED (or archive row; product choice at migration time)
 *
 * New CNS-only values (no legacy text): EXPIRED, REVISION_REQUESTED,
 * REVISED, REJECTED_AUTOMATICALLY.
 */
