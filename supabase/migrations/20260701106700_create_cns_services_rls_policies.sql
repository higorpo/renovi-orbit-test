-- CNS Phase 11 — task 75: RLS on public.services (contracted service, design §3.7, §11.2).
-- Depends on task 6 (services table). Insert only via accept_proposal RPC (task 78 REVOKE).

alter table public.services enable row level security;

create policy services_select
  on public.services
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or (select auth.uid()) in (client_id, provider_id)
  );

create policy services_insert_denied
  on public.services
  for insert
  to authenticated
  with check (false);

create policy services_update_denied
  on public.services
  for update
  to authenticated
  using (false)
  with check (false);

create policy services_delete_denied
  on public.services
  for delete
  to authenticated
  using (false);

comment on policy services_select on public.services is
  'Contract readable by client, provider, or admin after accept (R23-AC02, task 75).';
