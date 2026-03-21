-- Eligibility helper and RPC to create provider questions on service requests.
-- Depends on provider_offered_services, provider_service_area_neighborhoods, provider_proposals.

create or replace function public.can_provider_ask_question(
  p_provider_id uuid,
  p_service_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    join public.platform_services s on s.id = sr.service_id
    join public.client_addresses ca on ca.id = sr.address_id
    where sr.id = p_service_request_id
      and sr.status = 'open'
      and exists (
        select 1
        from public.provider_offered_services pos
        where pos.provider_id = p_provider_id
          and (pos.service_id = sr.service_id or pos.service_id = s.parent_id)
      )
      and exists (
        select 1
        from public.provider_service_area_neighborhoods psan
        join public.platform_neighborhoods pn on pn.id = psan.neighborhood_id
        where psan.provider_id = p_provider_id
          and pn.city_id = ca.city_id
      )
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.service_request_id = sr.id
          and pp.provider_id = p_provider_id
          and pp.status <> 'withdrawn'
      )
      and (
        select count(*)::integer
        from public.provider_proposals pp
        where pp.service_request_id = sr.id
          and pp.status not in ('withdrawn', 'rejected')
      ) < 3
  );
$$;

comment on function public.can_provider_ask_question is 'Checks if a provider is allowed to ask a question for a service request currently eligible in provider matching rules.';

create or replace function public.create_provider_service_request_question(
  p_service_request_id uuid,
  p_question text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_question text;
  v_existing_questions_count integer;
  v_question_id uuid;
  v_created_at timestamptz;
begin
  v_provider_id := auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can ask questions';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  -- Serialize writes per provider/request pair to enforce the 3-question limit under concurrency.
  perform pg_advisory_xact_lock(
    hashtextextended(v_provider_id::text || ':' || p_service_request_id::text, 0)
  );

  v_question := nullif(trim(p_question), '');
  if v_question is null then
    raise exception 'Question is required';
  end if;

  if char_length(v_question) > 1000 then
    raise exception 'Question is too long';
  end if;

  select count(*)::integer
  into v_existing_questions_count
  from public.provider_service_request_questions q
  where q.service_request_id = p_service_request_id
    and q.provider_id = v_provider_id;

  if v_existing_questions_count >= 3 then
    raise exception 'Question limit reached for this service request';
  end if;

  if not public.can_provider_ask_question(v_provider_id, p_service_request_id) then
    raise exception 'This service request is not available for questions';
  end if;

  insert into public.provider_service_request_questions (
    service_request_id,
    provider_id,
    question
  ) values (
    p_service_request_id,
    v_provider_id,
    v_question
  )
  returning id, created_at
  into v_question_id, v_created_at;

  return jsonb_build_object(
    'id', v_question_id,
    'created_at', v_created_at
  );
end;
$$;

comment on function public.create_provider_service_request_question is 'Creates a provider question for an eligible open service request. Only providers can call this function.';

revoke execute on function public.create_provider_service_request_question(uuid, text) from anon;
grant execute on function public.create_provider_service_request_question(uuid, text) to authenticated;
