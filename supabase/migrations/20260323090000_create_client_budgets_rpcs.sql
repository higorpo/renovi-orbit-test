-- Client "Orçamentos" RPCs and question response images support.

alter table public.provider_service_request_questions
  add column if not exists client_response_images text[] not null default '{}';

comment on column public.provider_service_request_questions.client_response_images is
  'Storage paths for optional client response images (max 5).';

-- Private bucket for client response images.
-- Path: clients/{client_id}/question-responses/{service_request_id}/{question_id}/{filename}
insert into storage.buckets (id, name, public)
values ('client-question-responses', 'client-question-responses', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

create policy "Clients can insert own question response images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-question-responses'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Clients can update own question response images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-question-responses'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'client-question-responses'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Clients can delete own question response images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-question-responses'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

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
      count(*) filter (where pp.status = 'submitted')::int as submitted_count,
      count(*) filter (where pp.status = 'accepted')::int as accepted_count,
      count(*) filter (where pp.status = 'rejected')::int as rejected_count,
      count(*) filter (where pp.status = 'withdrawn')::int as withdrawn_count
    from public.service_requests sr
    join public.provider_proposals pp on pp.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and (
        p_status is null
        or (p_status = 'awaiting_decision' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'submitted'))
        or (p_status = 'accepted' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'accepted'))
        or (p_status = 'rejected' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'rejected'))
        or (p_status = 'withdrawn' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'withdrawn'))
        or (p_status = 'closed' and sr.status in ('in_progress', 'closed', 'cancelled'))
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
      count(*) filter (where pp.status = 'submitted')::int as submitted_count,
      count(*) filter (where pp.status = 'accepted')::int as accepted_count,
      count(*) filter (where pp.status = 'rejected')::int as rejected_count,
      count(*) filter (where pp.status = 'withdrawn')::int as withdrawn_count
    from public.service_requests sr
    join public.provider_proposals pp on pp.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and (
        p_status is null
        or (p_status = 'awaiting_decision' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'submitted'))
        or (p_status = 'accepted' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'accepted'))
        or (p_status = 'rejected' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'rejected'))
        or (p_status = 'withdrawn' and exists (select 1 from public.provider_proposals p2 where p2.service_request_id = sr.id and p2.status = 'withdrawn'))
        or (p_status = 'closed' and sr.status in ('in_progress', 'closed', 'cancelled'))
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

revoke all on function public.list_client_received_budgets(integer, integer, text, text) from public;
revoke all on function public.list_client_received_budgets(integer, integer, text, text) from anon;
grant execute on function public.list_client_received_budgets(integer, integer, text, text) to authenticated;

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
      count(*) filter (where q.client_response is null and sr.status = 'open')::int as pending_questions_count,
      count(*) filter (where q.client_response is not null and sr.status = 'open')::int as answered_questions_count,
      max(q.created_at) as latest_question_at
    from public.service_requests sr
    join public.provider_service_request_questions q on q.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and (
        p_question_status is null
        or (p_question_status = 'pending' and q.client_response is null and sr.status = 'open')
        or (p_question_status = 'answered' and q.client_response is not null and sr.status = 'open')
        or (p_question_status = 'closed' and sr.status in ('in_progress', 'closed', 'cancelled'))
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
      count(*) filter (where q.client_response is null and sr.status = 'open')::int as pending_questions_count,
      count(*) filter (where q.client_response is not null and sr.status = 'open')::int as answered_questions_count,
      max(q.created_at) as latest_question_at
    from public.service_requests sr
    join public.provider_service_request_questions q on q.service_request_id = sr.id
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.client_id = v_client_id
      and (
        p_question_status is null
        or (p_question_status = 'pending' and q.client_response is null and sr.status = 'open')
        or (p_question_status = 'answered' and q.client_response is not null and sr.status = 'open')
        or (p_question_status = 'closed' and sr.status in ('in_progress', 'closed', 'cancelled'))
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
            order by q.created_at desc
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

revoke all on function public.list_client_budget_questions(integer, integer, text, text) from public;
revoke all on function public.list_client_budget_questions(integer, integer, text, text) from anon;
grant execute on function public.list_client_budget_questions(integer, integer, text, text) to authenticated;

create or replace function public.get_client_budget_service_request_detail(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_result jsonb;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.service_requests sr
    where sr.id = p_service_request_id and sr.client_id = v_client_id
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  with sr as (
    select
      sr.id,
      sr.title,
      sr.description,
      sr.status,
      sr.created_at,
      ps.title as service_title,
      ps.slug as service_slug,
      ps.icon_key as service_icon_key,
      ps.color_key as service_color_key,
      ca.neighborhood,
      pc.name as city,
      pst.abbreviation::text as state_abbr
    from public.service_requests sr
    join public.platform_services ps on ps.id = sr.service_id
    left join public.client_addresses ca on ca.id = sr.address_id
    left join public.platform_cities pc on pc.id = ca.city_id
    left join public.platform_states pst on pst.id = ca.state_id
    where sr.id = p_service_request_id
  ),
  budgets as (
    select
      pp.id,
      pp.provider_id,
      coalesce(ppub.display_name, p.full_name, 'Prestador') as provider_name,
      ppub.slug as provider_slug,
      p.profile_image_path as provider_profile_image_path,
      pp.proposed_amount,
      pp.status,
      pp.created_at,
      pp.proposal_description,
      pp.photos,
      pp.client_response_deadline_at
    from public.provider_proposals pp
    join public.profiles p on p.id = pp.provider_id
    left join public.provider_profiles_public ppub on ppub.provider_id = pp.provider_id
    where pp.service_request_id = p_service_request_id
    order by pp.created_at desc
  ),
  questions as (
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
    where q.service_request_id = p_service_request_id
    order by
      (q.client_response is null) desc,
      q.created_at desc
  )
  select jsonb_build_object(
    'service_request', (select to_jsonb(sr.*) from sr),
    'budgets', coalesce((select jsonb_agg(to_jsonb(budgets.*)) from budgets), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(questions.*)) from questions), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_client_budget_service_request_detail(uuid) from public;
revoke all on function public.get_client_budget_service_request_detail(uuid) from anon;
grant execute on function public.get_client_budget_service_request_detail(uuid) to authenticated;

create or replace function public.respond_client_budget_question(
  p_question_id uuid,
  p_response text,
  p_response_images text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_service_request_id uuid;
begin
  v_client_id := (select auth.uid());
  if v_client_id is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_client_id and p.role = 'client') then
    raise exception 'Apenas clientes podem responder perguntas' using errcode = '42501';
  end if;
  if p_response is null or char_length(trim(p_response)) = 0 then
    raise exception 'Resposta é obrigatória';
  end if;
  if char_length(trim(p_response)) > 1000 then
    raise exception 'Resposta deve ter no máximo 1000 caracteres';
  end if;
  if coalesce(array_length(p_response_images, 1), 0) > 5 then
    raise exception 'Você pode enviar no máximo 5 imagens';
  end if;

  select q.service_request_id
  into v_service_request_id
  from public.provider_service_request_questions q
  join public.service_requests sr on sr.id = q.service_request_id
  where q.id = p_question_id
    and sr.client_id = v_client_id;

  if v_service_request_id is null then
    raise exception 'Pergunta não encontrada para este cliente' using errcode = '42501';
  end if;

  update public.provider_service_request_questions q
  set
    client_response = trim(p_response),
    client_response_images = coalesce(p_response_images, '{}'),
    client_responded_at = now(),
    updated_at = now()
  where q.id = p_question_id;

  return jsonb_build_object(
    'question_id', p_question_id,
    'service_request_id', v_service_request_id,
    'responded_at', now()
  );
end;
$$;

revoke all on function public.respond_client_budget_question(uuid, text, text[]) from public;
revoke all on function public.respond_client_budget_question(uuid, text, text[]) from anon;
grant execute on function public.respond_client_budget_question(uuid, text, text[]) to authenticated;
