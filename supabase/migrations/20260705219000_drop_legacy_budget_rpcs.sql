-- Drop legacy budget RPCs replaced by get_service + PostgREST provider_proposals reads
-- and reject_proposal (CNS idempotent mutation).

drop function if exists public.get_client_budget_service_request_detail(uuid);
drop function if exists public.reject_client_budget_proposal(uuid, text);
drop function if exists public.list_client_received_budgets(integer, integer, text, text);
drop function if exists public.get_provider_proposal_job_detail(uuid, uuid);
drop function if exists public.get_provider_proposal_job_detail(uuid, uuid, double precision, double precision, integer);

comment on function public.match_provider_jobs is
  'Returns paginated, ranked service requests matching a provider''s services and area. Used by the match-provider-jobs Edge Function. Single-request detail uses get_service.';
