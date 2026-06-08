-- Drop provider-budgets list RPC (feature removed).
-- Signature verified against local DB introspection (2026-06-08).

drop function if exists public.list_provider_sent_budgets(
  integer,
  integer,
  text,
  text
);
