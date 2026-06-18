-- EXPLAIN baseline: beacon path on provider_latest_locations (task 52).
-- Run: docker exec -i supabase_db_<id> psql -U postgres -d postgres -f - < supabase/scripts/matching-discovery-explain-beacon-path.sql

\set sr_id '7017e457-5a32-44e7-b8da-1727a14f4d33'

-- Upsert locations for existing seed providers (no new auth users)
INSERT INTO public.provider_latest_locations (
  provider_id,
  location,
  h3_index,
  location_recorded_at,
  device_id
)
SELECT
  p.id,
  extensions.st_setsrid(
    extensions.st_makepoint(
      -46.6333 + (random() - 0.5) * 0.2,
      -23.5505 + (random() - 0.5) * 0.2
    ),
    4326
  )::extensions.geography,
  public.matching_latlng_to_h3_cell(
    extensions.st_setsrid(
      extensions.st_makepoint(
        -46.6333 + (random() - 0.5) * 0.2,
        -23.5505 + (random() - 0.5) * 0.2
      ),
      4326
    )::extensions.geography,
    public.platform_constant_int('matching.h3_resolution', 7)
  ),
  now(),
  'perf-seed-' || p.id::text
FROM public.profiles p
WHERE p.role = 'provider'
  AND p.operational_status = 'active'::public.provider_operational_status
ON CONFLICT (provider_id) DO UPDATE SET
  location = excluded.location,
  h3_index = excluded.h3_index,
  location_recorded_at = excluded.location_recorded_at,
  device_id = excluded.device_id,
  updated_at = now();

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH sr AS (
  SELECT
    sr.id,
    sr.location,
    sr.service_id,
    CASE
      WHEN sr.h3_index IS NOT NULL AND btrim(sr.h3_index) ~ '^[0-9]+$' THEN sr.h3_index::bigint
      ELSE NULL::bigint
    END AS center_h3
  FROM public.service_requests sr
  WHERE sr.id = :'sr_id'::uuid
),
h3_cells AS (
  SELECT cell
  FROM sr
  CROSS JOIN LATERAL public.matching_h3_ring_cells(sr.center_h3, public.platform_constant_int('matching.h3_resolution', 7)) AS cell
)
SELECT
  pll.provider_id,
  pll.device_id,
  extensions.st_distance(pll.location, sr.location) AS distance_meters
FROM public.provider_latest_locations pll
JOIN public.profiles p ON p.id = pll.provider_id
JOIN public.provider_offered_services pos
  ON pos.provider_id = p.id
  AND pos.service_id = (SELECT service_id FROM sr)
JOIN sr ON true
WHERE p.operational_status = 'active'::public.provider_operational_status
  AND pll.location IS NOT NULL
  AND sr.location IS NOT NULL
  AND pll.location_recorded_at >= now() - interval '24 hours'
  AND extensions.st_dwithin(pll.location, sr.location, 20000)
  AND (
    NOT EXISTS (SELECT 1 FROM h3_cells)
    OR pll.h3_index IN (SELECT hc.cell FROM h3_cells hc)
  )
ORDER BY distance_meters NULLS LAST, pll.provider_id
LIMIT 200;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.matching_discover_candidates(:'sr_id'::uuid, 200);
