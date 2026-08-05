-- Service completion Task 4: append-only service_request_enrichment_events (design §3.3).

create table public.service_request_enrichment_events (
  id uuid primary key default gen_random_uuid(),
  enrichment_id uuid not null,
  service_request_id uuid not null
    references public.service_requests (id) on delete cascade,
  from_status public.enrichment_status,
  to_status public.enrichment_status not null,
  actor text not null,
  event_type text not null,
  lease_generation bigint,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Composite FK ties event SR to the enrichment row (forensic integrity).
  -- ON DELETE CASCADE: SR hard-delete cascades enrichments then events (soft cancel
  -- never DELETEs SRs). Forensic retention relies on soft cancel + evidence RESTRICT.
  constraint enrichment_events_enrichment_sr_fk
    foreign key (enrichment_id, service_request_id)
    references public.service_request_enrichments (id, service_request_id)
    on delete cascade
);

comment on table public.service_request_enrichment_events is
  'Append-only enrichment FSM audit. Inserts via RPC helper only; no client UPDATE/DELETE.';

comment on column public.service_request_enrichment_events.actor is
  'system | worker | user | RPC name';
comment on column public.service_request_enrichment_events.event_type is
  'CLAIMED|RETRY|READY|FALLBACK|ABORTED|RECLAIM|…';
comment on constraint enrichment_events_enrichment_sr_fk
  on public.service_request_enrichment_events is
  'Composite FK (enrichment_id, service_request_id); CASCADE with enrichment for SR cleanup.';

create index idx_enrichment_events_enrichment_created
  on public.service_request_enrichment_events (enrichment_id, created_at);

create index idx_enrichment_events_sr_created
  on public.service_request_enrichment_events (service_request_id, created_at);

-- RECLAIM metrics window (Task 56 service_completion_ops_metrics)
create index idx_enrichment_events_reclaim_created
  on public.service_request_enrichment_events (created_at)
  where event_type = 'RECLAIM';

comment on index public.idx_enrichment_events_reclaim_created is
  'Partial index for lease reclaim count metrics (event_type = RECLAIM).';

-- Append-only posture: no UPDATE/DELETE for clients or service_role (insert via DEFINER RPC).
-- Retention prune (Task 56 companion in 044800) uses SECURITY DEFINER owned by table owner.
revoke update, delete, truncate on table public.service_request_enrichment_events from public;
revoke update, delete, truncate on table public.service_request_enrichment_events from anon;
revoke update, delete, truncate on table public.service_request_enrichment_events from authenticated;
revoke update, delete, truncate on table public.service_request_enrichment_events from service_role;
