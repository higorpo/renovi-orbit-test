-- Service completion Task 9: RLS deny-by-default + SELECT sketches (design §11.2.1).
-- Mutations: SECURITY DEFINER RPCs only — no authenticated INSERT/UPDATE/DELETE policies.
-- Full deny-matrix pgTAP: Task 60.
--
-- Enrichments: no authenticated table SELECT — clients/providers read via
-- get_service_completion_context (SECURITY DEFINER bypasses RLS as owner). Direct
-- SELECT would expose lease_owner / ops internals; app does not query this table.

-- ---------------------------------------------------------------------------
-- Enable RLS on all completion/enrichment persistence tables
-- ---------------------------------------------------------------------------
alter table public.service_request_enrichments enable row level security;
alter table public.service_request_enrichment_events enable row level security;
alter table public.completion_checklist_templates enable row level security;
alter table public.contracted_service_completion_evidence enable row level security;
alter table public.completion_evidence_upload_sessions enable row level security;
alter table public.completion_evidence_upload_objects enable row level security;

-- ---------------------------------------------------------------------------
-- GRANT / REVOKE posture: fail closed for anon; authenticated SELECT only where policy exists
-- ---------------------------------------------------------------------------
revoke all on table public.service_request_enrichments from public, anon;
revoke all on table public.service_request_enrichment_events from public, anon;
revoke all on table public.completion_checklist_templates from public, anon;
revoke all on table public.contracted_service_completion_evidence from public, anon;
revoke all on table public.completion_evidence_upload_sessions from public, anon;
revoke all on table public.completion_evidence_upload_objects from public, anon;

revoke insert, update, delete, truncate
  on table public.service_request_enrichments
  from authenticated;
revoke insert, update, delete, truncate
  on table public.service_request_enrichment_events
  from authenticated;
revoke insert, update, delete, truncate
  on table public.completion_checklist_templates
  from authenticated;
revoke insert, update, delete, truncate
  on table public.contracted_service_completion_evidence
  from authenticated;
revoke insert, update, delete, truncate
  on table public.completion_evidence_upload_sessions
  from authenticated;
revoke insert, update, delete, truncate
  on table public.completion_evidence_upload_objects
  from authenticated;

-- Templates, enrichment rows, enrichment events: no authenticated SELECT
-- (workers/service_role; product reads enrichment via get_service_completion_context).
revoke select on table public.completion_checklist_templates from authenticated;
revoke select on table public.service_request_enrichments from authenticated;
revoke select on table public.service_request_enrichment_events from authenticated;

grant select on table public.contracted_service_completion_evidence to authenticated;
grant select on table public.completion_evidence_upload_sessions to authenticated;
grant select on table public.completion_evidence_upload_objects to authenticated;

grant select, insert, update, delete on table public.service_request_enrichments to service_role;
grant select, insert on table public.service_request_enrichment_events to service_role;
grant select, insert, update, delete on table public.completion_checklist_templates to service_role;
grant select, insert, update, delete on table public.contracted_service_completion_evidence to service_role;
grant select, insert, update, delete on table public.completion_evidence_upload_sessions to service_role;
grant select, insert, update, delete on table public.completion_evidence_upload_objects to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Enrichments: RLS on, zero authenticated policies + no SELECT grant ⇒ deny-by-default.
-- Product reads via get_service_completion_context (DEFINER). Workers use service_role.

-- Evidence: one SELECT policy (provider draft+frozen OR client frozen-only) — RLS perf rule.
create policy evidence_select_participant
  on public.contracted_service_completion_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.contracted_services cs
      where cs.id = contracted_service_id
        and cs.provider_id = (select auth.uid())
    )
    or (
      phase = 'frozen'
      and exists (
        select 1
        from public.contracted_services cs
        where cs.id = contracted_service_id
          and cs.client_id = (select auth.uid())
      )
    )
  );

comment on policy evidence_select_participant on public.contracted_service_completion_evidence is
  'Provider reads draft+frozen; client reads frozen only. Writes via DEFINER RPCs.';

-- Upload sessions: provider owns SELECT; writes via DEFINER RPCs (not FOR ALL).
create policy upload_session_select_provider
  on public.completion_evidence_upload_sessions
  for select
  to authenticated
  using (provider_id = (select auth.uid()));

comment on policy upload_session_select_provider on public.completion_evidence_upload_sessions is
  'Provider may SELECT own upload sessions; create/register via DEFINER RPCs.';

-- Upload objects: visible to session-owning provider
create policy upload_object_select_provider
  on public.completion_evidence_upload_objects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.completion_evidence_upload_sessions s
      where s.id = session_id
        and s.provider_id = (select auth.uid())
    )
  );

comment on policy upload_object_select_provider on public.completion_evidence_upload_objects is
  'Provider may SELECT objects under own upload sessions.';

-- Templates / enrichments / enrichment_events: RLS on, zero authenticated policies ⇒ deny-by-default.
