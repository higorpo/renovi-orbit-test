-- Payment Task 6: payment_gateway_tokens (design.md §3.2, §11.2).
-- Ops-only table: service_role access via Edge Functions; no authenticated/anon policies.

create table public.payment_gateway_tokens (
  gateway_slug public.payment_gateway_slug primary key default 'netcred',
  token text not null,
  expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payment_gateway_tokens is
  'Cached NetCred JWT (one row per gateway_slug). Vault holds credentials used to obtain the token.';

comment on column public.payment_gateway_tokens.token is
  'JWT from NetCred tokenAuth; not the Vault password.';

comment on column public.payment_gateway_tokens.expires_at is
  'Token expiry; refresh when expires_at - now() < 60 minutes.';

create trigger payment_gateway_tokens_updated_at
  before update on public.payment_gateway_tokens
  for each row
  execute procedure public.set_updated_at();

alter table public.payment_gateway_tokens enable row level security;

revoke all on table public.payment_gateway_tokens from public;
revoke all on table public.payment_gateway_tokens from anon;
revoke all on table public.payment_gateway_tokens from authenticated;

grant select, insert, update, delete on table public.payment_gateway_tokens to service_role;
