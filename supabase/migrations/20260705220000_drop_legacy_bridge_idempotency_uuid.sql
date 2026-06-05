-- Orphaned helper from CNS Wave D (20260701105400); no callers remain after
-- create_provider_proposal unified RPC and submit_proposal removal.

drop function if exists public._legacy_bridge_idempotency_uuid(text);
