-- Payment Task 7: client_card_tokens (design.md §3.3, §11.2).
-- Clients SELECT own rows via safe view only; mutations via service_role (tokenize EF + payment_* RPCs).

create or replace function public.payment_client_card_token_is_expired(
  p_expiry_month smallint,
  p_expiry_year smallint
)
returns boolean
language sql
stable
parallel safe
set search_path = public
as $$
  select make_date(p_expiry_year::int, p_expiry_month::int, 1)
    < date_trunc('month', timezone('utc', now()))::date;
$$;

comment on function public.payment_client_card_token_is_expired(smallint, smallint) is
  'True when card expiry month/year is before the current UTC month.';

create table public.client_card_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  gateway_slug public.payment_gateway_slug not null default 'netcred',
  gateway_payment_profile_id text not null,
  card_number_masked text not null,
  card_brand text not null,
  gateway_card_token text not null,
  expiry_month smallint not null
    constraint client_card_tokens_expiry_month_check
      check (expiry_month between 1 and 12),
  expiry_year smallint not null
    constraint client_card_tokens_expiry_year_check
      check (expiry_year between 2000 and 2100),
  cardholder_name text not null,
  billing_address jsonb not null,
  state public.payment_client_card_token_state not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_card_tokens_client_profile_unique
    unique (client_id, gateway_payment_profile_id)
);

comment on table public.client_card_tokens is
  'Gateway-issued card tokens per client. No raw PAN or CVV columns (PCI).';

comment on column public.client_card_tokens.gateway_payment_profile_id is
  'NetCred paymentProfile.id — opaque gateway reference.';

comment on column public.client_card_tokens.gateway_card_token is
  'NetCred paymentProfile.token — opaque gateway reference; not exposed via client_card_tokens_safe_v.';

comment on column public.client_card_tokens.billing_address is
  'Billing address JSON: street, number, district, city, state, zipCode, additionalDetails.';

create index client_card_tokens_client_state_idx
  on public.client_card_tokens (client_id, state);

create index client_card_tokens_gateway_profile_id_idx
  on public.client_card_tokens (gateway_payment_profile_id);

create trigger client_card_tokens_updated_at
  before update on public.client_card_tokens
  for each row
  execute procedure public.set_updated_at();

alter table public.client_card_tokens enable row level security;

create policy client_card_tokens_select_own
  on public.client_card_tokens
  for select
  to authenticated
  using ((select auth.uid()) = client_id);

create view public.client_card_tokens_safe_v
with (security_invoker = true) as
select
  cct.id,
  cct.client_id,
  cct.gateway_slug,
  cct.gateway_payment_profile_id,
  cct.card_number_masked,
  cct.card_brand,
  cct.expiry_month,
  cct.expiry_year,
  cct.cardholder_name,
  cct.state,
  cct.created_at,
  cct.updated_at
from public.client_card_tokens cct;

comment on view public.client_card_tokens_safe_v is
  'Client-facing card token read model; excludes gateway_card_token and billing_address (PCI).';

revoke all on table public.client_card_tokens from public;
revoke all on table public.client_card_tokens from anon;

revoke insert, update, delete on table public.client_card_tokens from authenticated;
revoke select on table public.client_card_tokens from authenticated;

grant select (
  id,
  client_id,
  gateway_slug,
  gateway_payment_profile_id,
  card_number_masked,
  card_brand,
  expiry_month,
  expiry_year,
  cardholder_name,
  state,
  created_at,
  updated_at
) on table public.client_card_tokens to authenticated;

grant select, insert, update, delete on table public.client_card_tokens to service_role;

revoke all on public.client_card_tokens_safe_v from public;
revoke all on public.client_card_tokens_safe_v from anon;

grant select on public.client_card_tokens_safe_v to authenticated;

revoke all on function public.payment_client_card_token_is_expired(smallint, smallint) from public;
revoke all on function public.payment_client_card_token_is_expired(smallint, smallint) from anon;

grant execute on function public.payment_client_card_token_is_expired(smallint, smallint) to service_role;
grant execute on function public.payment_client_card_token_is_expired(smallint, smallint) to authenticated;
