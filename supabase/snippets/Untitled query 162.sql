-- Remover trigger
drop trigger if exists provider_proposals_updated_at on public.provider_proposals;

-- Remover policies da tabela
drop policy if exists "Providers read own proposals" on public.provider_proposals;
drop policy if exists "Providers insert own proposals" on public.provider_proposals;
drop policy if exists "Providers update own proposals" on public.provider_proposals;
drop policy if exists "Clients read proposals on own requests" on public.provider_proposals;
drop policy if exists "Admins read all proposals" on public.provider_proposals;

-- Remover policies do storage
drop policy if exists "Providers can insert own proposal images" on storage.objects;
drop policy if exists "Providers can update own proposal images" on storage.objects;
drop policy if exists "Providers can delete own proposal images" on storage.objects;
drop policy if exists "Providers clients and admins can read proposal images" on storage.objects;

-- Remover índices
drop index if exists public.provider_proposals_unique_active;
drop index if exists public.provider_proposals_service_request_id_idx;
drop index if exists public.provider_proposals_provider_id_idx;
drop index if exists public.provider_proposals_status_idx;

-- Remover tabela
drop table if exists public.provider_proposals cascade;

-- Remover bucket (opcional)
delete from storage.buckets
where id = 'provider-proposals';

-- Provider proposals: tracks proposals/quotes from providers on service requests.
-- Used by the matching algorithm to filter out already-proposed requests
-- and enforce the max proposals per request limit (currently 3).

create table if not exists public.provider_proposals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  proposed_amount numeric(10,2) not null check (proposed_amount > 0),
  proposal_description text not null check (char_length(trim(proposal_description)) > 0 and char_length(trim(proposal_description)) <= 1200),
  photos text[] not null default '{}'::text[],
  tax_rate numeric(6,4) not null check (tax_rate >= 0 and tax_rate <= 1),
  tax_amount numeric(10,2) not null check (tax_amount >= 0),
  final_amount numeric(10,2) not null check (final_amount >= 0),
  pricing_signature text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_proposals is 'Proposals from providers on open service requests; used for matching eligibility and future proposal workflow.';
comment on column public.provider_proposals.provider_id is 'The provider who submitted the proposal.';
comment on column public.provider_proposals.service_request_id is 'The service request this proposal is for.';
comment on column public.provider_proposals.proposed_amount is 'Amount informed by provider before platform fee discount.';
comment on column public.provider_proposals.proposal_description is 'Proposal details written by provider.';
comment on column public.provider_proposals.photos is 'Storage paths of proposal images in provider-proposals bucket.';
comment on column public.provider_proposals.tax_rate is 'Applied platform fee rate used in calculation.';
comment on column public.provider_proposals.tax_amount is 'Amount discounted as platform fee.';
comment on column public.provider_proposals.final_amount is 'Final amount the provider receives after fee discount.';
comment on column public.provider_proposals.pricing_signature is 'HMAC signature for proposal pricing fields to prevent payload tampering.';
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



DROP FUNCTION calculate_provider_service_pricing(numeric,text);
-- Harden provider proposal pricing flow against payload tampering.
-- This migration centralizes pricing signature generation/validation and
-- updates RPCs so proposal creation is verified server-side.

insert into public.platform_constants (key, value)
values ('pricing_signature_secret', to_jsonb('renovi-provider-pricing-secret-v1'::text))
on conflict (key) do update set value = excluded.value;

create or replace function public.generate_provider_pricing_signature(
  p_original_amount numeric,
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret jsonb;
begin
  select value
  into v_secret
  from public.platform_constants
  where key = 'pricing_signature_secret';

  if v_secret is null or jsonb_typeof(v_secret) <> 'string' then
    raise exception 'Pricing signature secret is not configured';
  end if;

  return encode(
    hmac(
      concat_ws(
        '|',
        round(p_original_amount::numeric, 2)::text,
        round(p_tax_rate::numeric, 4)::text,
        round(p_tax_amount::numeric, 2)::text,
        round(p_final_amount::numeric, 2)::text
      ),
      trim(both '"' from v_secret::text),
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function public.calculate_provider_service_pricing(
  p_original_amount numeric,
  p_tax_key text default 'renovi_tax_provider'
)
returns table (
  original_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  final_amount numeric,
  pricing_signature text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_tax_value jsonb;
  v_tax_rate numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_user_role
  from public.profiles p
  where p.id = v_user_id;

  if v_user_role not in ('provider', 'admin') then
    raise exception 'Only providers and admins can calculate provider pricing';
  end if;

  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Original amount must be greater than zero';
  end if;

  select pc.value
  into v_tax_value
  from public.platform_constants pc
  where pc.key = p_tax_key;

  if v_tax_value is null then
    raise exception 'Platform constant not found for key: %', p_tax_key;
  end if;

  if jsonb_typeof(v_tax_value) <> 'number' then
    raise exception 'Tax constant must be a numeric JSON value for key: %', p_tax_key;
  end if;

  v_tax_rate := (v_tax_value)::text::numeric;

  if v_tax_rate < 0 or v_tax_rate > 1 then
    raise exception 'Tax rate must be between 0 and 1';
  end if;

  original_amount := round(p_original_amount::numeric, 2);
  tax_rate := v_tax_rate;
  tax_amount := round((p_original_amount * v_tax_rate)::numeric, 2);
  final_amount := round((p_original_amount - (p_original_amount * v_tax_rate))::numeric, 2);
  pricing_signature := public.generate_provider_pricing_signature(
    original_amount,
    tax_rate,
    tax_amount,
    final_amount
  );

  return next;
end;
$$;

comment on function public.calculate_provider_service_pricing(numeric, text) is 'Calculates provider pricing using a dynamic tax constant key and returns a tamper-proof pricing signature.';
revoke execute on function public.calculate_provider_service_pricing(numeric, text) from anon;
grant execute on function public.calculate_provider_service_pricing(numeric, text) to authenticated;

create or replace function public.validate_provider_proposal_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pricing record;
  v_expected_signature text;
begin
  select *
  into v_pricing
  from public.calculate_provider_service_pricing(new.proposed_amount);

  if v_pricing is null then
    raise exception 'Unable to validate proposal pricing';
  end if;

  if round(new.tax_rate::numeric, 4) <> round(v_pricing.tax_rate::numeric, 4)
    or round(new.tax_amount::numeric, 2) <> round(v_pricing.tax_amount::numeric, 2)
    or round(new.final_amount::numeric, 2) <> round(v_pricing.final_amount::numeric, 2) then
    raise exception 'Proposal pricing fields do not match server calculation';
  end if;

  v_expected_signature := public.generate_provider_pricing_signature(
    new.proposed_amount,
    new.tax_rate,
    new.tax_amount,
    new.final_amount
  );

  if new.pricing_signature <> v_expected_signature then
    raise exception 'Invalid proposal pricing signature';
  end if;

  return new;
end;
$$;

drop trigger if exists provider_proposals_validate_pricing on public.provider_proposals;
create trigger provider_proposals_validate_pricing
  before insert or update of proposed_amount, tax_rate, tax_amount, final_amount, pricing_signature
  on public.provider_proposals
  for each row execute function public.validate_provider_proposal_pricing();

create or replace function public.create_provider_proposal(
  p_service_request_id uuid,
  p_proposed_amount numeric,
  p_proposal_description text,
  p_photos text[],
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric,
  p_pricing_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_proposal_id uuid;
begin
  v_provider_id := auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can create proposals';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  if p_proposed_amount is null or p_proposed_amount <= 0 then
    raise exception 'Proposed amount must be greater than zero';
  end if;

  if nullif(trim(p_proposal_description), '') is null then
    raise exception 'Proposal description is required';
  end if;

  insert into public.provider_proposals (
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status
  ) values (
    v_provider_id,
    p_service_request_id,
    round(p_proposed_amount::numeric, 2),
    trim(p_proposal_description),
    coalesce(p_photos, '{}'::text[]),
    round(p_tax_rate::numeric, 4),
    round(p_tax_amount::numeric, 2),
    round(p_final_amount::numeric, 2),
    p_pricing_signature,
    'submitted'
  )
  returning id into v_proposal_id;

  return jsonb_build_object('id', v_proposal_id);
end;
$$;

revoke execute on function public.create_provider_proposal(uuid, numeric, text, text[], numeric, numeric, numeric, text) from anon;
grant execute on function public.create_provider_proposal(uuid, numeric, text, text[], numeric, numeric, numeric, text) to authenticated;
