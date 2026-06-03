-- Replace chat-scoped proposal read RPC with RLS-backed PostgREST selects.
-- SELECT allowed for platform admins, owning provider, or service-request client.

drop function if exists public.get_proposal_for_timeline(uuid, uuid);

drop policy if exists provider_proposals_select on public.provider_proposals;

create policy provider_proposals_select
  on public.provider_proposals
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or provider_proposals.provider_id = (select auth.uid())
    or exists (
      select 1
      from public.service_requests sr
      where sr.id = provider_proposals.service_request_id
        and sr.client_id = (select auth.uid())
    )
  );

comment on policy provider_proposals_select on public.provider_proposals is
  'Proposal rows readable by platform admin, owning provider, or service-request client.';
