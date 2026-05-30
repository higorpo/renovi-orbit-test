-- CNS Phase 11 — task 76: RLS on operational / internal tables (design §11.2, Req. 28/35).
-- service_role bypasses RLS; authenticated clients and providers have no broad access.

-- ---------------------------------------------------------------------------
-- domain_events, rpc_idempotency_records, job_runs — admin read; no authenticated writes
-- ---------------------------------------------------------------------------

alter table public.domain_events enable row level security;

create policy domain_events_admin_select
  on public.domain_events
  for select
  to authenticated
  using ((select public.is_platform_admin()));

alter table public.rpc_idempotency_records enable row level security;

create policy rpc_idempotency_records_admin_select
  on public.rpc_idempotency_records
  for select
  to authenticated
  using ((select public.is_platform_admin()));

alter table public.job_runs enable row level security;

create policy job_runs_admin_select
  on public.job_runs
  for select
  to authenticated
  using ((select public.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- chat_rate_limit_buckets — no authenticated policies (invisible to participants)
-- ---------------------------------------------------------------------------

alter table public.chat_rate_limit_buckets enable row level security;

-- ---------------------------------------------------------------------------
-- Append-only audit — admin read only (get_negotiation_audit_timeline uses SECURITY DEFINER)
-- ---------------------------------------------------------------------------

alter table public.chat_audit enable row level security;

create policy chat_audit_admin_select
  on public.chat_audit
  for select
  to authenticated
  using ((select public.is_platform_admin()));

alter table public.proposal_audit enable row level security;

create policy proposal_audit_admin_select
  on public.proposal_audit
  for select
  to authenticated
  using ((select public.is_platform_admin()));

comment on policy domain_events_admin_select on public.domain_events is
  'Outbox not readable by chat participants; admin support read only (task 76).';
