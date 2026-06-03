-- Align client/provider budget RPCs with CNS enums (service_request_status, proposal_status).
-- Legacy UI filter values (submitted, open, etc.) are mapped at the RPC boundary.

drop policy if exists "Clients providers and admins can read question response images" on storage.objects;

create policy "Clients providers and admins can read question response images"
  on storage.objects for select
  using (
    bucket_id = 'client-question-responses'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1
        from public.provider_service_request_questions q
        join public.service_requests sr on sr.id = q.service_request_id
        where q.id::text = (storage.foldername(name))[5]
          and sr.id::text = (storage.foldername(name))[4]
          and q.provider_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.provider_service_request_questions q
        join public.service_requests sr on sr.id = q.service_request_id
        join public.profiles p on p.id = (select auth.uid())
        where q.id::text = (storage.foldername(name))[5]
          and sr.id::text = (storage.foldername(name))[4]
          and sr.status = 'OPEN'::public.service_request_status
          and q.client_response is not null
          and p.role = 'provider'
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'admin'
      )
    )
  );



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
      count(*) filter (where pp.status = 'REJECTED'::public.proposal_status)::int as rejected_count,
      count(*) filter (where pp.status = 'REVISED'::public.proposal_status)::int as withdrawn_count
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
        or (p_status = 'rejected' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'REJECTED'::public.proposal_status))
        or (p_status = 'withdrawn' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'REVISED'::public.proposal_status))
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
      count(*) filter (where pp.status = 'REJECTED'::public.proposal_status)::int as rejected_count,
      count(*) filter (where pp.status = 'REVISED'::public.proposal_status)::int as withdrawn_count
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
        or (p_status = 'rejected' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'REJECTED'::public.proposal_status))
        or (p_status = 'withdrawn' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'REVISED'::public.proposal_status))
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
        'withdrawn_count', g.withdrawn_count,
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
                or (p_status = 'rejected' and pp.status = 'REJECTED'::public.proposal_status)
                or (p_status = 'withdrawn' and pp.status = 'REVISED'::public.proposal_status)
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


create or replace function public.list_client_budget_questions(
  p_page integer default 1,
  p_page_size integer default 20,
  p_question_status text default null,
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
  if not exists (select 1 from public.profiles p where p.id = v_client_id and p.role = 'client') then
    raise exception 'Apenas clientes podem listar perguntas' using errcode = '42501';
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
      count(q.id)::int as total_questions,
      count(*) filter (where q.client_response is null and sr.status = 'OPEN'::public.service_request_status)::int as pending_questions_count,
      count(*) filter (where q.client_response is not null and sr.status = 'OPEN'::public.service_request_status)::int as answered_questions_count,
      max(q.created_at) as latest_question_at
    from public.service_requests sr
    join public.provider_service_request_questions q on q.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and sr.status = 'OPEN'::public.service_request_status
      and (
        p_question_status is null
        or (p_question_status = 'pending' and q.client_response is null and sr.status = 'OPEN'::public.service_request_status)
        or (p_question_status = 'answered' and q.client_response is not null and sr.status = 'OPEN'::public.service_request_status)
      )
      and (
        v_search is null
        or lower(sr.title) like '%' || v_search || '%'
        or lower(ps.title) like '%' || v_search || '%'
        or lower(q.question) like '%' || v_search || '%'
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
      count(q.id)::int as total_questions,
      count(*) filter (where q.client_response is null and sr.status = 'OPEN'::public.service_request_status)::int as pending_questions_count,
      count(*) filter (where q.client_response is not null and sr.status = 'OPEN'::public.service_request_status)::int as answered_questions_count,
      max(q.created_at) as latest_question_at
    from public.service_requests sr
    join public.provider_service_request_questions q on q.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and sr.status = 'OPEN'::public.service_request_status
      and (
        p_question_status is null
        or (p_question_status = 'pending' and q.client_response is null and sr.status = 'OPEN'::public.service_request_status)
        or (p_question_status = 'answered' and q.client_response is not null and sr.status = 'OPEN'::public.service_request_status)
      )
      and (
        v_search is null
        or lower(sr.title) like '%' || v_search || '%'
        or lower(ps.title) like '%' || v_search || '%'
        or lower(q.question) like '%' || v_search || '%'
        or lower(coalesce(ca.neighborhood, '')) like '%' || v_search || '%'
        or lower(coalesce(pc.name, '')) like '%' || v_search || '%'
      )
    group by sr.id, ps.id, ca.id, pc.id, pst.id
    order by max(q.created_at) desc
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
        'total_questions', g.total_questions,
        'pending_questions_count', g.pending_questions_count,
        'answered_questions_count', g.answered_questions_count,
        'latest_question_at', g.latest_question_at,
        'questions_preview', (
          select coalesce(jsonb_agg((row_to_json(qp))::jsonb), '[]'::jsonb)
          from (
            select
              q.id,
              q.provider_id,
              coalesce(ppub.display_name, p.full_name, 'Prestador') as provider_name,
              ppub.slug as provider_slug,
              p.profile_image_path as provider_profile_image_path,
              q.question,
              q.client_response,
              q.client_response_images,
              q.created_at,
              q.client_responded_at
            from public.provider_service_request_questions q
            join public.profiles p on p.id = q.provider_id
            left join public.provider_profiles_public ppub on ppub.provider_id = q.provider_id
            where q.service_request_id = g.service_request_id
              and (
                (
                  p_question_status is null
                  and q.client_response is null
                  and g.service_request_status = 'OPEN'::public.service_request_status
                )
                or (
                  p_question_status is null
                  and not exists (
                    select 1
                    from public.provider_service_request_questions qn
                    where qn.service_request_id = g.service_request_id
                      and qn.client_response is null
                      and g.service_request_status = 'OPEN'::public.service_request_status
                  )
                  and q.client_response is not null
                )
                or (
                  p_question_status = 'pending'
                  and q.client_response is null
                  and g.service_request_status = 'OPEN'::public.service_request_status
                )
                or (
                  p_question_status = 'answered'
                  and q.client_response is not null
                  and g.service_request_status = 'OPEN'::public.service_request_status
                )
              )
            order by
              case when p_question_status is null then (q.client_response is null) else true end desc,
              q.created_at desc
            limit 3
          ) qp
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


create or replace function public.reject_client_budget_proposal(
  p_proposal_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_sr_id uuid;
  v_status public.proposal_status;
  v_deadline timestamptz;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_client_id and p.role = 'client') then
    raise exception 'Apenas clientes podem recusar orçamentos' using errcode = '42501';
  end if;
  if p_proposal_id is null then
    raise exception 'Orçamento é obrigatório';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Motivo da recusa é obrigatório';
  end if;
  if char_length(trim(p_reason)) > 2000 then
    raise exception 'Motivo deve ter no máximo 2000 caracteres';
  end if;

  select pp.service_request_id, pp.status, pp.client_response_deadline_at
  into v_sr_id, v_status, v_deadline
  from public.provider_proposals pp
  join public.service_requests sr on sr.id = pp.service_request_id
  where pp.id = p_proposal_id
    and sr.client_id = v_client_id
    and sr.status = 'OPEN'::public.service_request_status;

  if v_sr_id is null then
    raise exception 'Orçamento não encontrado para este pedido' using errcode = '42501';
  end if;

  if v_status <> 'PENDING'::public.proposal_status then
    raise exception 'Apenas orçamentos aguardando avaliação podem ser recusados';
  end if;

  if v_deadline is not null and v_deadline < now() then
    raise exception 'Prazo para responder este orçamento expirou';
  end if;

  update public.provider_proposals pp
  set
    status = 'REJECTED'::public.proposal_status,
    client_rejection_response = trim(p_reason),
    updated_at = now()
  where pp.id = p_proposal_id;

  return jsonb_build_object(
    'proposal_id', p_proposal_id,
    'service_request_id', v_sr_id,
    'status', 'REJECTED'
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
      OR pp.status = CASE lower(btrim(p_status))
        WHEN 'submitted' THEN 'PENDING'::public.proposal_status
        WHEN 'accepted' THEN 'ACCEPTED'::public.proposal_status
        WHEN 'rejected' THEN 'REJECTED'::public.proposal_status
        WHEN 'withdrawn' THEN 'REVISED'::public.proposal_status
        ELSE NULL
      END
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
      OR pp.status = CASE lower(btrim(p_status))
        WHEN 'submitted' THEN 'PENDING'::public.proposal_status
        WHEN 'accepted' THEN 'ACCEPTED'::public.proposal_status
        WHEN 'rejected' THEN 'REJECTED'::public.proposal_status
        WHEN 'withdrawn' THEN 'REVISED'::public.proposal_status
        ELSE NULL
      END
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
      OR (p_question_status = 'pending'  AND q.client_response IS NULL AND sr.status = 'OPEN'::public.service_request_status)
      OR (p_question_status = 'answered' AND q.client_response IS NOT NULL AND sr.status = 'OPEN'::public.service_request_status)
      OR (p_question_status = 'closed'   AND sr.status IN ('COMPLETED'::public.service_request_status, 'CANCELLED'::public.service_request_status))
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
      ) AS masked_client_name,
      EXISTS (
        SELECT 1 FROM provider_proposals pp2
        WHERE pp2.provider_id = v_provider_id
          AND pp2.service_request_id = sr.id
          AND pp2.status <> 'REVISED'::public.proposal_status
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
        OR (p_question_status = 'pending'  AND q.client_response IS NULL AND sr.status = 'OPEN'::public.service_request_status)
        OR (p_question_status = 'answered' AND q.client_response IS NOT NULL AND sr.status = 'OPEN'::public.service_request_status)
        OR (p_question_status = 'closed'   AND sr.status IN ('COMPLETED'::public.service_request_status, 'CANCELLED'::public.service_request_status))
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


