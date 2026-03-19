-- Provider proposals: tracks proposals/quotes from providers on service requests.
-- Used by the matching algorithm to filter out already-proposed requests
-- and enforce the max proposals per request limit (currently 3).

create table if not exists public.provider_proposals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_proposals is 'Proposals from providers on open service requests; used for matching eligibility and future proposal workflow.';
comment on column public.provider_proposals.provider_id is 'The provider who submitted the proposal.';
comment on column public.provider_proposals.service_request_id is 'The service request this proposal is for.';
comment on column public.provider_proposals.status is 'Lifecycle: submitted → accepted | rejected | withdrawn.';

-- One active (non-withdrawn) proposal per provider per request.
create unique index if not exists provider_proposals_unique_active
  on public.provider_proposals (provider_id, service_request_id)
  where status <> 'withdrawn';

create index if not exists provider_proposals_service_request_id_idx
  on public.provider_proposals (service_request_id);
create index if not exists provider_proposals_provider_id_idx
  on public.provider_proposals (provider_id);
create index if not exists provider_proposals_status_idx
  on public.provider_proposals (status);

alter table public.provider_proposals enable row level security;

create policy "Providers read own proposals"
  on public.provider_proposals for select
  using (auth.uid() = provider_id);

create policy "Providers insert own proposals"
  on public.provider_proposals for insert
  with check (auth.uid() = provider_id);

create policy "Providers update own proposals"
  on public.provider_proposals for update
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

create policy "Clients read proposals on own requests"
  on public.provider_proposals for select
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = provider_proposals.service_request_id
        and sr.client_id = auth.uid()
    )
  );

create policy "Admins read all proposals"
  on public.provider_proposals for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger provider_proposals_updated_at
  before update on public.provider_proposals
  for each row execute procedure public.set_updated_at();
