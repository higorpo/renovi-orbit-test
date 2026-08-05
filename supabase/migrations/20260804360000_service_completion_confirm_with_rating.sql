-- Service completion Task 36: service_completion_confirm_with_rating (design §5.5 / decision 12).
-- Atomic rating + COMPLETED; race with auto-complete via FOR UPDATE + status predicate.
-- pgTAP race suite: Task 70.

create or replace function public.service_completion_confirm_with_rating(
  p_contracted_service_id uuid,
  p_score_quality smallint,
  p_score_punctuality smallint,
  p_score_communication smallint,
  p_score_value smallint,
  p_comment text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_client_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_schedule_id uuid;
  v_is_disputed boolean;
  v_mmd jsonb;
  v_completed_at timestamptz := now();
  v_title text;
  v_rating_id uuid;
  v_overall numeric(4, 2);
  v_w_quality numeric;
  v_w_punctuality numeric;
  v_w_communication numeric;
  v_w_value numeric;
  v_idem text := nullif(btrim(p_idempotency_key), '');
  v_existing_rating_id uuid;
begin
  if v_client_id is null then
    raise exception 'Authentication required for service_completion_confirm_with_rating'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_score_quality is null
    or p_score_punctuality is null
    or p_score_communication is null
    or p_score_value is null
  then
    raise exception 'MISSING_RATING_SCORES'
      using errcode = '22023';
  end if;

  if p_score_quality not between 1 and 5
    or p_score_punctuality not between 1 and 5
    or p_score_communication not between 1 and 5
    or p_score_value not between 1 and 5
  then
    raise exception 'RATING_SCORES_OUT_OF_RANGE'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.client_id = v_client_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  -- Idempotent: already COMPLETED by client with rating
  if v_cs.status = 'COMPLETED'::public.contracted_service_status then
    select sr.id
    into v_existing_rating_id
    from public.service_ratings sr
    where sr.contracted_service_id = p_contracted_service_id;

    if v_existing_rating_id is not null
      and v_cs.completed_by = 'client'
    then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'contracted_service_id', p_contracted_service_id,
        'status', 'COMPLETED',
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by,
        'rating_id', v_existing_rating_id
      );
    end if;

    raise exception 'ALREADY_COMPLETED'
      using errcode = 'P0001';
  end if;

  if v_cs.status is distinct from 'EXECUTED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  -- EXECUTED must have frozen evidence before client can COMPLETE
  if not exists (
    select 1
    from public.contracted_service_completion_evidence ev
    where ev.contracted_service_id = p_contracted_service_id
      and ev.phase = 'frozen'::public.completion_evidence_phase
  ) then
    raise exception 'FROZEN_EVIDENCE_REQUIRED'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.service_ratings sr
    where sr.contracted_service_id = p_contracted_service_id
  ) then
    raise exception 'RATING_ALREADY_EXISTS'
      using errcode = '23505';
  end if;

  v_w_quality := public.platform_constant_numeric('matching.rating_dimension_weight_quality', 0.40);
  v_w_punctuality := public.platform_constant_numeric('matching.rating_dimension_weight_punctuality', 0.25);
  v_w_communication := public.platform_constant_numeric('matching.rating_dimension_weight_communication', 0.20);
  v_w_value := public.platform_constant_numeric('matching.rating_dimension_weight_value', 0.15);

  v_overall := round((
    v_w_quality * p_score_quality
    + v_w_punctuality * p_score_punctuality
    + v_w_communication * p_score_communication
    + v_w_value * p_score_value
  )::numeric, 2);

  -- Insert rating first; COMPLETED only if insert succeeds (same TX).
  insert into public.service_ratings (
    contracted_service_id,
    service_request_id,
    client_id,
    provider_id,
    score_quality,
    score_punctuality,
    score_communication,
    score_value,
    overall_score,
    comment
  )
  values (
    p_contracted_service_id,
    v_cs.service_request_id,
    v_cs.client_id,
    v_cs.provider_id,
    p_score_quality,
    p_score_punctuality,
    p_score_communication,
    p_score_value,
    v_overall,
    nullif(btrim(p_comment), '')
  )
  returning id into v_rating_id;

  update public.contracted_services cs
  set
    status = 'COMPLETED'::public.contracted_service_status,
    completed_at = v_completed_at,
    completed_by = 'client'
  where cs.id = p_contracted_service_id
    and cs.status = 'EXECUTED'::public.contracted_service_status
  returning * into v_cs;

  if not found then
    -- Lost race to auto-complete (or concurrent confirm)
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  select ps.id, ps.is_disputed
  into v_schedule_id, v_is_disputed
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
  order by ps.created_at desc
  limit 1;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_COMPLETED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'EXECUTED',
      p_to_state := 'COMPLETED',
      p_actor := 'client'::public.payment_audit_actor,
      p_actor_id := v_client_id,
      p_metadata := jsonb_build_object(
        'completed_at', v_completed_at,
        'completed_by', 'client',
        'rating_id', v_rating_id,
        'overall_score', v_overall,
        'is_disputed', coalesce(v_is_disputed, false),
        'idempotency_key', v_idem,
        'source', 'service_completion_confirm_with_rating'
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceCompleted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_payload := jsonb_build_object(
        'completed_by', 'client',
        'client_id', v_cs.client_id,
        'provider_id', v_cs.provider_id,
        'rating_id', v_rating_id,
        'is_disputed', coalesce(v_is_disputed, false)
      )
    );
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_COMPLETED',
    v_cs.provider_id,
    format('service_completion:%s:completed_client', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'completed_by', 'client',
      'rating_id', v_rating_id,
      'overall_score', v_overall,
      'service_request_title', v_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_confirm_with_rating',
      'recipient', 'provider',
      'idempotency_key', v_idem
    )
  );

  raise log
    'service_completion_confirm_with_rating cs_id=% rating_id=%',
    p_contracted_service_id,
    v_rating_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'contracted_service_id', p_contracted_service_id,
    'status', 'COMPLETED',
    'completed_at', v_completed_at,
    'completed_by', 'client',
    'rating_id', v_rating_id,
    'overall_score', v_overall,
    'provider_id', v_cs.provider_id,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) is
  'Client confirms EXECUTED CS with mandatory 4-dimension rating in one TX; requires frozen evidence; COMPLETED completed_by=client + MMD (Task 36 / decision 12). p_idempotency_key is audit/MMD metadata and status-replay only — not wired to rpc_idempotency_records.';

revoke all on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) from public;
revoke all on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) from anon;
revoke all on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) from service_role;

grant execute on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) to authenticated;
grant execute on function public.service_completion_confirm_with_rating(
  uuid, smallint, smallint, smallint, smallint, text, text
) to postgres;
