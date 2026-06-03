-- Budget list RPCs: fold REVISED into rejected tab; drop legacy withdrawn filter/count.
-- REVISED proposals appear under Recusados with label handled in the app.

create or replace function public.list_client_received_budgets(
  p_page integer default 1,
  p_page_size integer default 20,
  p_status text default null,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_offset integer;
  v_total bigint;
  v_items jsonb;
  v_search text;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_client_id and p.role = 'client'
  ) then
    raise exception 'Apenas clientes podem listar orçamentos recebidos' using errcode = '42501';
  end if;

  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);
  v_search := nullif(trim(lower(coalesce(p_search, ''))), '');

  with grouped as (
    select
      sr.id as service_request_id,
      sr.title as service_request_title,
      sr.description as service_request_description,
      sr.status as service_request_status,
      sr.created_at as service_request_created_at,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ca.neighborhood,
      pc.name as city,
      pst.abbreviation::text as state_abbr,
      max(pp.created_at) as latest_budget_at,
      count(pp.id)::int as total_budgets,
      count(*) filter (where pp.status = 'PENDING'::public.proposal_status)::int as submitted_count,
      count(*) filter (where pp.status = 'ACCEPTED'::public.proposal_status)::int as accepted_count,
      count(*) filter (where pp.status in (
        'REJECTED'::public.proposal_status,
        'REJECTED_AUTOMATICALLY'::public.proposal_status,
        'REVISED'::public.proposal_status
      ))::int as rejected_count
    from public.service_requests sr
    join public.provider_proposals pp on pp.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and sr.status = 'OPEN'::public.service_request_status
      and (
        p_status is null
        or (p_status = 'awaiting_decision' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'PENDING'::public.proposal_status))
        or (p_status = 'accepted' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'ACCEPTED'::public.proposal_status))
        or (p_status = 'rejected' and exists (
          select 1
          from public.provider_proposals p2
          where p2.service_request_id = sr.id
            and p2.status in (
              'REJECTED'::public.proposal_status,
              'REJECTED_AUTOMATICALLY'::public.proposal_status,
              'REVISED'::public.proposal_status
            )
        ))
      )
      and (
        v_search is null
        or lower(sr.title) like '%' || v_search || '%'
        or lower(ps.title) like '%' || v_search || '%'
        or lower(coalesce(ca.neighborhood, '')) like '%' || v_search || '%'
        or lower(coalesce(pc.name, '')) like '%' || v_search || '%'
      )
    group by sr.id, ps.id, ca.id, pc.id, pst.id
  )
  select count(*) into v_total from grouped;

  with grouped as (
    select
      sr.id as service_request_id,
      sr.title as service_request_title,
      sr.description as service_request_description,
      sr.status as service_request_status,
      sr.created_at as service_request_created_at,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ca.neighborhood,
      pc.name as city,
      pst.abbreviation::text as state_abbr,
      max(pp.created_at) as latest_budget_at,
      count(pp.id)::int as total_budgets,
      count(*) filter (where pp.status = 'PENDING'::public.proposal_status)::int as submitted_count,
      count(*) filter (where pp.status = 'ACCEPTED'::public.proposal_status)::int as accepted_count,
      count(*) filter (where pp.status in (
        'REJECTED'::public.proposal_status,
        'REJECTED_AUTOMATICALLY'::public.proposal_status,
        'REVISED'::public.proposal_status
      ))::int as rejected_count
    from public.service_requests sr
    join public.provider_proposals pp on pp.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and sr.status = 'OPEN'::public.service_request_status
      and (
        p_status is null
        or (p_status = 'awaiting_decision' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'PENDING'::public.proposal_status))
        or (p_status = 'accepted' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'ACCEPTED'::public.proposal_status))
        or (p_status = 'rejected' and exists (
          select 1
          from public.provider_proposals p2
          where p2.service_request_id = sr.id
            and p2.status in (
              'REJECTED'::public.proposal_status,
              'REJECTED_AUTOMATICALLY'::public.proposal_status,
              'REVISED'::public.proposal_status
            )
        ))
      )
      and (
        v_search is null
        or lower(sr.title) like '%' || v_search || '%'
        or lower(ps.title) like '%' || v_search || '%'
        or lower(coalesce(ca.neighborhood, '')) like '%' || v_search || '%'
        or lower(coalesce(pc.name, '')) like '%' || v_search || '%'
      )
    group by sr.id, ps.id, ca.id, pc.id, pst.id
    order by max(pp.created_at) desc
    limit greatest(p_page_size, 1)
    offset v_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'service_request_id', g.service_request_id,
        'service_request_title', g.service_request_title,
        'service_request_description', g.service_request_description,
        'service_request_status', g.service_request_status,
        'service_request_created_at', g.service_request_created_at,
        'service_title', g.service_title,
        'service_slug', g.service_slug,
        'service_icon_key', g.service_icon_key,
        'service_color_key', g.service_color_key,
        'neighborhood', g.neighborhood,
        'city', g.city,
        'state_abbr', g.state_abbr,
        'latest_budget_at', g.latest_budget_at,
        'total_budgets', g.total_budgets,
        'submitted_count', g.submitted_count,
        'accepted_count', g.accepted_count,
        'rejected_count', g.rejected_count,
        'budgets_preview', (
          select coalesce(jsonb_agg((row_to_json(pv))::jsonb), '[]'::jsonb)
          from (
            select
              pp.id,
              pp.provider_id,
              coalesce(ppub.display_name, p.full_name, 'Prestador') as provider_name,
              ppub.slug as provider_slug,
              p.profile_image_path as provider_profile_image_path,
              pp.proposed_amount,
              pp.status,
              pp.created_at
            from public.provider_proposals pp
            join public.profiles p on p.id = pp.provider_id
            left join public.provider_profiles_public ppub on ppub.provider_id = pp.provider_id
            where pp.service_request_id = g.service_request_id
              and (
                (p_status is null and pp.status = 'PENDING'::public.proposal_status)
                or (p_status = 'awaiting_decision' and pp.status = 'PENDING'::public.proposal_status)
                or (p_status = 'accepted' and pp.status = 'ACCEPTED'::public.proposal_status)
                or (p_status = 'rejected' and pp.status in (
          'REJECTED'::public.proposal_status,
          'REJECTED_AUTOMATICALLY'::public.proposal_status,
          'REVISED'::public.proposal_status
        ))
              )
            order by pp.created_at desc
            limit 3
          ) pv
        )
      )
    ),
    '[]'::jsonb
  )
  into v_items
  from grouped g;

  return jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', greatest(p_page, 1),
    'page_size', greatest(p_page_size, 1)
  );
end;
$$;


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
    AND (
      p_status IS NULL
      OR (
        lower(btrim(p_status)) = 'submitted'
        AND pp.status = 'PENDING'::public.proposal_status
      )
      OR (
        lower(btrim(p_status)) = 'accepted'
        AND pp.status = 'ACCEPTED'::public.proposal_status
      )
      OR (
        lower(btrim(p_status)) = 'rejected'
        AND pp.status IN (
          'REJECTED'::public.proposal_status,
          'REJECTED_AUTOMATICALLY'::public.proposal_status,
          'REVISED'::public.proposal_status
        )
      )
    )
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
      (
        split_part(p.full_name, ' ', 1) ||
        case
          when array_length(string_to_array(p.full_name, ' '), 1) > 1
          then ' ' || left(
            split_part(
              p.full_name, ' ',
              array_length(string_to_array(p.full_name, ' '), 1)
            ), 1
          ) || '.'
          else ''
        end
      ) AS masked_client_name
    FROM provider_proposals pp
    JOIN service_requests sr   ON sr.id  = pp.service_request_id
    JOIN platform_services ps  ON ps.id  = sr.service_id
    LEFT JOIN client_addresses ca ON ca.id = sr.address_id
    LEFT JOIN platform_cities  pc ON pc.id = ca.city_id
    LEFT JOIN platform_states  pst ON pst.id = ca.state_id
    LEFT JOIN profiles p       ON p.id   = sr.client_id
    WHERE pp.provider_id = v_provider_id
      AND (
      p_status IS NULL
      OR (
        lower(btrim(p_status)) = 'submitted'
        AND pp.status = 'PENDING'::public.proposal_status
      )
      OR (
        lower(btrim(p_status)) = 'accepted'
        AND pp.status = 'ACCEPTED'::public.proposal_status
      )
      OR (
        lower(btrim(p_status)) = 'rejected'
        AND pp.status IN (
          'REJECTED'::public.proposal_status,
          'REJECTED_AUTOMATICALLY'::public.proposal_status,
          'REVISED'::public.proposal_status
        )
      )
    )
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

