-- RPCs for the provider "Orçamentos" screen.
-- Both functions support server-side pagination, status filtering and text search.
--
-- Security model:
-- - EXECUTE: granted only to role `authenticated`; revoked from PUBLIC and `anon`.
-- - Callers must have profiles.role = 'provider' (enforced inside each function).
-- - Rows are always scoped to (select auth.uid()) as provider_id.
-- - SECURITY DEFINER is required so the function can JOIN client data
--   (profiles.full_name for masking, client_addresses for city/neighborhood).
--
-- Direct table access remains governed by existing RLS.

-- ============================================================================
-- list_provider_sent_budgets (paginated, filterable)
-- ============================================================================
CREATE OR REPLACE FUNCTION list_provider_sent_budgets(
  p_page        integer DEFAULT 1,
  p_page_size   integer DEFAULT 20,
  p_status      text    DEFAULT NULL,
  p_search      text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_offset      integer;
  v_total       bigint;
  v_items       jsonb;
  v_search      text;
BEGIN
  v_provider_id := (SELECT auth.uid());

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_provider_id AND pr.role = 'provider'
  ) THEN
    RAISE EXCEPTION 'Apenas prestadores podem listar orçamentos enviados'
      USING ERRCODE = '42501';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_page_size, 1);
  v_search := NULLIF(TRIM(LOWER(COALESCE(p_search, ''))), '');

  -- total_count (with same filters, no pagination)
  SELECT COUNT(*)
  INTO v_total
  FROM provider_proposals pp
  JOIN service_requests sr   ON sr.id = pp.service_request_id
  JOIN platform_services ps  ON ps.id = sr.service_id
  LEFT JOIN client_addresses ca ON ca.id = sr.address_id
  LEFT JOIN platform_cities  pc ON pc.id = ca.city_id
  LEFT JOIN profiles p       ON p.id   = sr.client_id
  WHERE pp.provider_id = v_provider_id
    AND (p_status IS NULL OR pp.status = p_status)
    AND (
      v_search IS NULL
      OR LOWER(sr.title) LIKE '%' || v_search || '%'
      OR LOWER(ps.title) LIKE '%' || v_search || '%'
      OR LOWER(COALESCE(ca.neighborhood, '')) LIKE '%' || v_search || '%'
      OR LOWER(COALESCE(pc.name, '')) LIKE '%' || v_search || '%'
      OR LOWER(
        CASE
          WHEN p.full_name IS NULL OR p.full_name = '' THEN 'cliente'
          WHEN position(' ' in p.full_name) > 0 THEN
            LOWER(split_part(p.full_name, ' ', 1))
          ELSE LOWER(p.full_name)
        END
      ) LIKE '%' || v_search || '%'
    );

  -- items (paginated); row_to_jsonb does not exist — use row_to_json::jsonb
  SELECT COALESCE(
    (
      SELECT jsonb_agg((row_to_json(s))::jsonb)
      FROM (
    SELECT
      pp.id,
      pp.proposed_amount,
      pp.proposal_description,
      pp.status,
      pp.created_at,
      pp.updated_at,
      pp.tax_rate,
      pp.tax_amount,
      pp.final_amount,
      pp.photos,
      pp.client_rejection_response,
      sr.id              AS service_request_id,
      sr.title           AS service_request_title,
      sr.description     AS service_request_description,
      sr.photos          AS service_request_photos,
      sr.urgency         AS service_request_urgency,
      sr.status          AS service_request_status,
      sr.created_at      AS service_request_created_at,
      ps.title           AS service_title,
      ps.slug            AS service_slug,
      ps.icon_key        AS service_icon_key,
      ps.color_key       AS service_color_key,
      ca.neighborhood,
      pc.name            AS city,
      pst.abbreviation::text AS state_abbr,
      CASE
        WHEN p.full_name IS NULL OR p.full_name = '' THEN 'Cliente'
        WHEN position(' ' in p.full_name) > 0 THEN
          split_part(p.full_name, ' ', 1) || ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
        ELSE p.full_name
      END AS masked_client_name
    FROM provider_proposals pp
    JOIN service_requests sr   ON sr.id  = pp.service_request_id
    JOIN platform_services ps  ON ps.id  = sr.service_id
    LEFT JOIN client_addresses ca ON ca.id = sr.address_id
    LEFT JOIN platform_cities  pc ON pc.id = ca.city_id
    LEFT JOIN platform_states  pst ON pst.id = ca.state_id
    LEFT JOIN profiles p       ON p.id   = sr.client_id
    WHERE pp.provider_id = v_provider_id
      AND (p_status IS NULL OR pp.status = p_status)
      AND (
        v_search IS NULL
        OR LOWER(sr.title) LIKE '%' || v_search || '%'
        OR LOWER(ps.title) LIKE '%' || v_search || '%'
        OR LOWER(COALESCE(ca.neighborhood, '')) LIKE '%' || v_search || '%'
        OR LOWER(COALESCE(pc.name, '')) LIKE '%' || v_search || '%'
        OR LOWER(
          CASE
            WHEN p.full_name IS NULL OR p.full_name = '' THEN 'cliente'
            WHEN position(' ' in p.full_name) > 0 THEN
              LOWER(split_part(p.full_name, ' ', 1))
            ELSE LOWER(p.full_name)
          END
        ) LIKE '%' || v_search || '%'
      )
    ORDER BY pp.created_at DESC
    LIMIT GREATEST(p_page_size, 1)
    OFFSET v_offset
      ) s
    ),
    '[]'::jsonb
  )
  INTO v_items;

  RETURN jsonb_build_object(
    'items',       v_items,
    'total_count', v_total,
    'page',        GREATEST(p_page, 1),
    'page_size',   GREATEST(p_page_size, 1)
  );
END;
$$;

COMMENT ON FUNCTION list_provider_sent_budgets(integer, integer, text, text) IS
  'Lista orçamentos enviados pelo prestador autenticado (role=provider) com paginação, filtro de status e busca textual.';

REVOKE ALL ON FUNCTION list_provider_sent_budgets(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_provider_sent_budgets(integer, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION list_provider_sent_budgets(integer, integer, text, text) TO authenticated;


-- ============================================================================
-- list_provider_own_questions (paginated, filterable)
-- ============================================================================
-- p_question_status maps to derived status:
--   'pending'  = client_response IS NULL AND sr.status = 'open'
--   'answered' = client_response IS NOT NULL AND sr.status = 'open'
--   'closed'   = sr.status IN ('in_progress', 'closed', 'cancelled')
CREATE OR REPLACE FUNCTION list_provider_own_questions(
  p_page             integer DEFAULT 1,
  p_page_size        integer DEFAULT 20,
  p_question_status  text    DEFAULT NULL,
  p_search           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_offset      integer;
  v_total       bigint;
  v_items       jsonb;
  v_search      text;
BEGIN
  v_provider_id := (SELECT auth.uid());

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_provider_id AND pr.role = 'provider'
  ) THEN
    RAISE EXCEPTION 'Apenas prestadores podem listar perguntas enviadas'
      USING ERRCODE = '42501';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_page_size, 1);
  v_search := NULLIF(TRIM(LOWER(COALESCE(p_search, ''))), '');

  SELECT COUNT(*)
  INTO v_total
  FROM provider_service_request_questions q
  JOIN service_requests sr  ON sr.id = q.service_request_id
  JOIN platform_services ps ON ps.id = sr.service_id
  LEFT JOIN client_addresses ca ON ca.id = sr.address_id
  LEFT JOIN platform_cities  pc ON pc.id = ca.city_id
  LEFT JOIN profiles p       ON p.id   = sr.client_id
  WHERE q.provider_id = v_provider_id
    AND (
      p_question_status IS NULL
      OR (p_question_status = 'pending'  AND q.client_response IS NULL AND sr.status = 'open')
      OR (p_question_status = 'answered' AND q.client_response IS NOT NULL AND sr.status = 'open')
      OR (p_question_status = 'closed'   AND sr.status IN ('in_progress', 'closed', 'cancelled'))
    )
    AND (
      v_search IS NULL
      OR LOWER(sr.title) LIKE '%' || v_search || '%'
      OR LOWER(ps.title) LIKE '%' || v_search || '%'
      OR LOWER(q.question) LIKE '%' || v_search || '%'
      OR LOWER(COALESCE(ca.neighborhood, '')) LIKE '%' || v_search || '%'
      OR LOWER(COALESCE(pc.name, '')) LIKE '%' || v_search || '%'
      OR LOWER(
        CASE
          WHEN p.full_name IS NULL OR p.full_name = '' THEN 'cliente'
          WHEN position(' ' in p.full_name) > 0 THEN
            LOWER(split_part(p.full_name, ' ', 1))
          ELSE LOWER(p.full_name)
        END
      ) LIKE '%' || v_search || '%'
    );

  SELECT COALESCE(
    (
      SELECT jsonb_agg((row_to_json(s))::jsonb)
      FROM (
    SELECT
      q.id,
      q.question,
      q.client_response,
      q.created_at,
      q.client_responded_at,
      sr.id              AS service_request_id,
      sr.title           AS service_request_title,
      sr.description     AS service_request_description,
      sr.photos          AS service_request_photos,
      sr.urgency         AS service_request_urgency,
      sr.status          AS service_request_status,
      sr.created_at      AS service_request_created_at,
      ps.title           AS service_title,
      ps.slug            AS service_slug,
      ps.icon_key        AS service_icon_key,
      ps.color_key       AS service_color_key,
      ca.neighborhood,
      pc.name            AS city,
      pst.abbreviation::text AS state_abbr,
      CASE
        WHEN p.full_name IS NULL OR p.full_name = '' THEN 'Cliente'
        WHEN position(' ' in p.full_name) > 0 THEN
          split_part(p.full_name, ' ', 1) || ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
        ELSE p.full_name
      END AS masked_client_name,
      EXISTS (
        SELECT 1 FROM provider_proposals pp2
        WHERE pp2.provider_id = v_provider_id
          AND pp2.service_request_id = sr.id
          AND pp2.status != 'withdrawn'
      ) AS has_proposal
    FROM provider_service_request_questions q
    JOIN service_requests sr   ON sr.id  = q.service_request_id
    JOIN platform_services ps  ON ps.id  = sr.service_id
    LEFT JOIN client_addresses ca ON ca.id = sr.address_id
    LEFT JOIN platform_cities  pc ON pc.id = ca.city_id
    LEFT JOIN platform_states  pst ON pst.id = ca.state_id
    LEFT JOIN profiles p       ON p.id   = sr.client_id
    WHERE q.provider_id = v_provider_id
      AND (
        p_question_status IS NULL
        OR (p_question_status = 'pending'  AND q.client_response IS NULL AND sr.status = 'open')
        OR (p_question_status = 'answered' AND q.client_response IS NOT NULL AND sr.status = 'open')
        OR (p_question_status = 'closed'   AND sr.status IN ('in_progress', 'closed', 'cancelled'))
      )
      AND (
        v_search IS NULL
        OR LOWER(sr.title) LIKE '%' || v_search || '%'
        OR LOWER(ps.title) LIKE '%' || v_search || '%'
        OR LOWER(q.question) LIKE '%' || v_search || '%'
        OR LOWER(COALESCE(ca.neighborhood, '')) LIKE '%' || v_search || '%'
        OR LOWER(COALESCE(pc.name, '')) LIKE '%' || v_search || '%'
        OR LOWER(
          CASE
            WHEN p.full_name IS NULL OR p.full_name = '' THEN 'cliente'
            WHEN position(' ' in p.full_name) > 0 THEN
              LOWER(split_part(p.full_name, ' ', 1))
            ELSE LOWER(p.full_name)
          END
        ) LIKE '%' || v_search || '%'
      )
    ORDER BY q.created_at DESC
    LIMIT GREATEST(p_page_size, 1)
    OFFSET v_offset
      ) s
    ),
    '[]'::jsonb
  )
  INTO v_items;

  RETURN jsonb_build_object(
    'items',       v_items,
    'total_count', v_total,
    'page',        GREATEST(p_page, 1),
    'page_size',   GREATEST(p_page_size, 1)
  );
END;
$$;

COMMENT ON FUNCTION list_provider_own_questions(integer, integer, text, text) IS
  'Lista perguntas feitas pelo prestador autenticado (role=provider) com paginação, filtro de status derivado e busca textual.';

REVOKE ALL ON FUNCTION list_provider_own_questions(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_provider_own_questions(integer, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION list_provider_own_questions(integer, integer, text, text) TO authenticated;
