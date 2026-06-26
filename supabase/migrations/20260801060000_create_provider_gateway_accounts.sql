-- Payment Task 8: provider_gateway_accounts (design.md §3.4, §11.2).
-- Provider SELECT own row (+ admin); mutations via service_role onboarding RPCs/EFs.

create table public.provider_gateway_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete restrict,
  gateway_slug public.payment_gateway_slug not null default 'netcred',
  document text not null,
  netcred_company_id text,
  netcred_bank_account_id text,
  onboarding_status public.payment_provider_onboarding_status not null default 'PENDING_DOCUMENTS',
  onboarding_submitted_at timestamptz,
  onboarding_activated_at timestamptz,
  email_dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_gateway_accounts_provider_gateway_unique
    unique (provider_id, gateway_slug)
);

comment on table public.provider_gateway_accounts is
  'Provider NetCred credentialing account; one row per provider at MVP.';

comment on column public.provider_gateway_accounts.document is
  'CPF or CNPJ digits only; synced from provider_profiles_private on KYC submit.';

comment on column public.provider_gateway_accounts.netcred_company_id is
  'Populated when onboarding_status reaches ACTIVE via detect-netcred-onboarding.';

comment on column public.provider_gateway_accounts.email_dispatched_at is
  'Set when KYC onboarding email is confirmed sent.';

create index provider_gateway_accounts_onboarding_status_idx
  on public.provider_gateway_accounts (onboarding_status)
  where onboarding_status in (
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  );

create trigger provider_gateway_accounts_updated_at
  before update on public.provider_gateway_accounts
  for each row
  execute procedure public.set_updated_at();

alter table public.provider_gateway_accounts enable row level security;

create policy provider_gateway_accounts_select_own_or_admin
  on public.provider_gateway_accounts
  for select
  to authenticated
  using (
    (select auth.uid()) = provider_id
    or (select public.is_platform_admin())
  );

revoke all on table public.provider_gateway_accounts from public;
revoke all on table public.provider_gateway_accounts from anon;

revoke insert, update, delete on table public.provider_gateway_accounts from authenticated;

grant select on table public.provider_gateway_accounts to authenticated;
grant select, insert, update, delete on table public.provider_gateway_accounts to service_role;

create or replace function public.payment_provider_is_credentialed(
  p_provider_id uuid,
  p_gateway_slug public.payment_gateway_slug default 'netcred'::public.payment_gateway_slug
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_gateway_accounts pga
    where pga.provider_id = p_provider_id
      and pga.gateway_slug = p_gateway_slug
      and pga.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
  );
$$;

comment on function public.payment_provider_is_credentialed(uuid, public.payment_gateway_slug) is
  'True when provider has ACTIVE gateway onboarding for the given slug.';

revoke all on function public.payment_provider_is_credentialed(uuid, public.payment_gateway_slug) from public;
revoke all on function public.payment_provider_is_credentialed(uuid, public.payment_gateway_slug) from anon;
revoke all on function public.payment_provider_is_credentialed(uuid, public.payment_gateway_slug) from authenticated;

grant execute on function public.payment_provider_is_credentialed(uuid, public.payment_gateway_slug) to service_role;

create index provider_gateway_accounts_active_idx
  on public.provider_gateway_accounts (provider_id, gateway_slug)
  where onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status;

