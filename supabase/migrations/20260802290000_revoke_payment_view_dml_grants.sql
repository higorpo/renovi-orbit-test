-- Harden payment read-model views: authenticated may SELECT only (no DML).
-- Views may remain updatable at the Postgres catalog level; client roles must not hold DML grants.
-- Do not change security_invoker here (SELECT path intentionally bypasses CLS for projected amounts).

-- ---------------------------------------------------------------------------
-- client_payment_transactions_v
-- ---------------------------------------------------------------------------
revoke all on public.client_payment_transactions_v from public;
revoke all on public.client_payment_transactions_v from anon;
revoke all on public.client_payment_transactions_v from authenticated;

grant select on public.client_payment_transactions_v to authenticated;

-- ---------------------------------------------------------------------------
-- provider_payment_receivables_v
-- ---------------------------------------------------------------------------
revoke all on public.provider_payment_receivables_v from public;
revoke all on public.provider_payment_receivables_v from anon;
revoke all on public.provider_payment_receivables_v from authenticated;

grant select on public.provider_payment_receivables_v to authenticated;

-- ---------------------------------------------------------------------------
-- provider_settlement_movements_v
-- ---------------------------------------------------------------------------
revoke all on public.provider_settlement_movements_v from public;
revoke all on public.provider_settlement_movements_v from anon;
revoke all on public.provider_settlement_movements_v from authenticated;

grant select on public.provider_settlement_movements_v to authenticated;

-- ---------------------------------------------------------------------------
-- client_card_tokens_safe_v
-- ---------------------------------------------------------------------------
revoke all on public.client_card_tokens_safe_v from public;
revoke all on public.client_card_tokens_safe_v from anon;
revoke all on public.client_card_tokens_safe_v from authenticated;

grant select on public.client_card_tokens_safe_v to authenticated;

-- Post-apply verification (manual / pgTAP):
--   has_table_privilege('authenticated', view, 'SELECT') = true
--   has_table_privilege('authenticated', view, 'INSERT'|'UPDATE'|'DELETE'|'TRUNCATE') = false
