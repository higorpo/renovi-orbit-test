-- EXPLAIN baseline: list_provider_opportunities feed (task 53).
-- Run: docker exec -i supabase_db_<id> psql -U postgres -d postgres -f - < supabase/scripts/matching-feed-explain-baseline.sql

\set provider_id '5d09e025-20a2-4842-aeef-324d42a431e1'
\set chat_window_hours 24

-- Ensure at least one batch visibility row for seed provider
INSERT INTO public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
VALUES (
  '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
  :'provider_id'::uuid,
  'batch',
  now()
)
ON CONFLICT DO NOTHING;

-- Plan A: batch arm — visibility-driven feed (core index path)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  sr.id AS service_request_id,
  sr.title,
  v.granted_at
FROM public.service_request_provider_visibility v
JOIN public.service_requests sr ON sr.id = v.service_request_id
JOIN public.service_request_dispatches d ON d.service_request_id = sr.id
JOIN public.platform_services ps ON ps.id = sr.service_id
JOIN public.client_addresses ca ON ca.id = sr.address_id
WHERE v.provider_id = :'provider_id'::uuid
  AND v.source = 'batch'
  AND v.revoked_at IS NULL
  AND v.dismissed_at IS NULL
  AND sr.status = 'OPEN'::public.service_request_status
  AND d.status NOT IN (
    'DISPATCH_MATCHED'::public.service_request_dispatch_status,
    'DISPATCH_CANCELLED'::public.service_request_dispatch_status
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.provider_proposals pp
    WHERE pp.provider_id = :'provider_id'::uuid
      AND pp.service_request_id = sr.id
      AND pp.status IN (
        'PENDING'::public.proposal_status,
        'REVISION_REQUESTED'::public.proposal_status
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.service_request_id = sr.id
      AND c.provider_id = :'provider_id'::uuid
      AND c.status = 'ACTIVE'::public.cns_conversation_status
      AND c.last_interaction_at >= now() - (:'chat_window_hours' || ' hours')::interval
      AND EXISTS (
        SELECT 1 FROM public.chat_messages m WHERE m.chat_id = c.id
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.provider_proposals pp
    WHERE pp.provider_id = :'provider_id'::uuid
      AND pp.service_request_id = sr.id
      AND pp.status <> 'REVISED'::public.proposal_status
  )
ORDER BY v.granted_at DESC, sr.id
LIMIT 21;

-- Plan B: full RPC timing (service_role) — run interactively with \timing on; EXPLAIN not supported (temp table).
