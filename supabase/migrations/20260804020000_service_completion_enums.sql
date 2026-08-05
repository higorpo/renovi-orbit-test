-- Service completion Task 2: enums for enrichment FSM and evidence persistence (design §3).

create type public.enrichment_status as enum (
  'PENDING',
  'RUNNING',
  'READY',
  'ABORTED'
);

comment on type public.enrichment_status is
  'Publication-readiness FSM for service_request_enrichments: PENDING→RUNNING→READY|ABORTED.';

create type public.checklist_source as enum (
  'ai',
  'fallback_template'
);

comment on type public.checklist_source is
  'How checklist_schema was materialized: AI worker or template cascade fallback.';

create type public.completion_evidence_phase as enum (
  'draft',
  'frozen'
);

comment on type public.completion_evidence_phase is
  'Evidence package lifecycle: draft until mark-executed freeze; frozen is immutable.';

create type public.completion_upload_session_status as enum (
  'open',
  'committed',
  'expired',
  'aborted'
);

comment on type public.completion_upload_session_status is
  'Provider evidence upload session lifecycle for completion checklist images.';
