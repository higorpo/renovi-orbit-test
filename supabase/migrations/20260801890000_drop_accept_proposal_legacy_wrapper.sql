-- Remove legacy 3-arg accept_proposal wrapper; payment payload is required.

drop function if exists public.accept_proposal(uuid, jsonb, uuid);
