-- Provider proposals: tracks proposals/quotes from providers on service requests.
-- Used by the matching algorithm to filter out already-proposed requests
-- and enforce the max proposals per request limit (currently 3).

create table if not exists public.provider_proposals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  proposed_amount numeric(10,2) not null check (proposed_amount > 0),
  proposal_description text not null check (char_length(trim(proposal_description)) > 0 and char_length(trim(proposal_description)) <= 1200),
  proposal_duration_value integer not null check (proposal_duration_value > 0),
  proposal_duration_unit text not null check (proposal_duration_unit in ('hours', 'days')),
  proposal_suggested_slots jsonb not null default '[]'::jsonb,
  photos text[] not null default '{}'::text[],
  tax_rate numeric(6,4) not null check (tax_rate >= 0 and tax_rate <= 1),
  tax_amount numeric(10,2) not null check (tax_amount >= 0),
  final_amount numeric(10,2) not null check (final_amount >= 0),
  pricing_signature text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  client_rejection_response text
    check (client_rejection_response is null or char_length(trim(client_rejection_response)) <= 2000),
  constraint provider_proposals_rejection_response_required
    check (
      status <> 'rejected'
      or nullif(trim(client_rejection_response), '') is not null
    ),
  constraint provider_proposals_suggested_slots_array
    check (jsonb_typeof(proposal_suggested_slots) = 'array'),
  constraint provider_proposals_suggested_slots_size
    check (jsonb_array_length(proposal_suggested_slots) between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_proposals is 'Proposals from providers on open service requests; used for matching eligibility and future proposal workflow.';
comment on column public.provider_proposals.provider_id is 'The provider who submitted the proposal.';
comment on column public.provider_proposals.service_request_id is 'The service request this proposal is for.';
comment on column public.provider_proposals.proposed_amount is 'Amount informed by provider before platform fee discount.';
comment on column public.provider_proposals.proposal_description is 'Proposal details written by provider.';
comment on column public.provider_proposals.proposal_duration_value is 'Estimated duration value informed by provider.';
comment on column public.provider_proposals.proposal_duration_unit is 'Estimated duration unit: hours or days.';
comment on column public.provider_proposals.proposal_suggested_slots is 'Suggested availability slots (1-3 options) informed by provider.';
comment on column public.provider_proposals.photos is 'Storage paths of proposal images in provider-proposals bucket.';
comment on column public.provider_proposals.tax_rate is 'Applied platform fee rate used in calculation.';
comment on column public.provider_proposals.tax_amount is 'Amount discounted as platform fee.';
comment on column public.provider_proposals.final_amount is 'Final amount the provider receives after fee discount.';
comment on column public.provider_proposals.pricing_signature is 'HMAC signature for proposal pricing fields to prevent payload tampering.';
comment on column public.provider_proposals.status is 'Lifecycle: submitted → accepted | rejected | withdrawn.';
comment on column public.provider_proposals.client_rejection_response is 'Optional message from the client when rejecting this proposal.';

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
create index if not exists provider_proposals_provider_request_latest_idx
  on public.provider_proposals (provider_id, service_request_id, updated_at desc, created_at desc);
create index if not exists provider_proposals_active_request_idx
  on public.provider_proposals (service_request_id)
  where status not in ('withdrawn', 'rejected');

alter table public.provider_proposals enable row level security;

create policy "Providers read own proposals"
  on public.provider_proposals for select
  using (auth.uid() = provider_id);

create policy "Providers insert own proposals"
  on public.provider_proposals for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  );

create policy "Providers update own proposals"
  on public.provider_proposals for update
  using (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  )
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  );

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

-- Private storage bucket for proposal images.
-- Path convention: providers/{provider_id}/proposals/{service_request_id}/{filename}
insert into storage.buckets (id, name, public)
values ('provider-proposals', 'provider-proposals', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

create policy "Providers can insert own proposal images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'provider-proposals'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Providers can update own proposal images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'provider-proposals'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'provider-proposals'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Providers can delete own proposal images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'provider-proposals'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Providers clients and admins can read proposal images"
  on storage.objects for select
  using (
    bucket_id = 'provider-proposals'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1
        from public.service_requests sr
        where sr.id::text = (storage.foldername(name))[4]
          and sr.client_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    )
  );
