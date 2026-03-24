create or replace function public.list_provider_service_request_questions(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_can_view boolean;
  v_result jsonb;
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
    raise exception 'Only providers can view service request questions';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  select exists (
    select 1
    from public.service_requests sr
    where sr.id = p_service_request_id
      and sr.status = 'open'
  )
  into v_can_view;

  if not v_can_view then
    raise exception 'Forbidden';
  end if;

  with own_questions as (
    select
      q.id,
      q.question,
      q.client_response,
      q.client_response_images,
      q.created_at,
      q.client_responded_at,
      true as is_own_question,
      null::text as provider_first_name
    from public.provider_service_request_questions q
    where q.service_request_id = p_service_request_id
      and q.provider_id = v_provider_id
  ),
  answered_other_questions as (
    select
      q.id,
      q.question,
      q.client_response,
      q.client_response_images,
      q.created_at,
      q.client_responded_at,
      false as is_own_question,
      split_part(coalesce(p.full_name, ''), ' ', 1) as provider_first_name
    from public.provider_service_request_questions q
    join public.profiles p on p.id = q.provider_id
    where q.service_request_id = p_service_request_id
      and q.provider_id <> v_provider_id
      and q.client_response is not null
  ),
  visible_questions as (
    select * from own_questions
    union all
    select * from answered_other_questions
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', vq.id,
        'question', vq.question,
        'client_response', vq.client_response,
        'client_response_images', coalesce(to_jsonb(vq.client_response_images), '[]'::jsonb),
        'created_at', vq.created_at,
        'client_responded_at', vq.client_responded_at,
        'is_own_question', vq.is_own_question,
        'provider_first_name', vq.provider_first_name
      )
      order by vq.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from visible_questions vq;

  return v_result;
end;
$$;