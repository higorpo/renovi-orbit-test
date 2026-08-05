-- Service completion Task 18: enrichment_schedule_retry (design §6.4).

create or replace function public.enrichment_schedule_retry(
  p_enrichment_id uuid,
  p_lease_owner text,
  p_lease_generation bigint,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
  v_base int;
  v_max_attempts int;
  v_new_attempt int;
  v_exponent int;
  v_delay_seconds int;
  v_jitter int;
  v_next timestamptz;
  -- Cap backoff so 2^n cannot blow past a sane wall-clock delay.
  v_max_delay_seconds constant int := 3600;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_schedule_retry'
      using errcode = '42501';
  end if;

  if p_enrichment_id is null then
    raise exception 'p_enrichment_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_lease_owner), '') is null then
    raise exception 'p_lease_owner is required'
      using errcode = '22023';
  end if;

  if p_lease_generation is null then
    raise exception 'p_lease_generation is required'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.service_request_enrichments e
  where e.id = p_enrichment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  if v_row.status is distinct from 'RUNNING'::public.enrichment_status
    or v_row.lease_owner is distinct from btrim(p_lease_owner)
    or v_row.lease_generation is distinct from p_lease_generation
  then
    -- Unified soft-fail reason with finalize / ops_attention lease CAS.
    return jsonb_build_object('ok', false, 'reason', 'STALE_LEASE_OR_STATE');
  end if;

  v_max_attempts := public.platform_constant_int('checklist_ai_max_attempts', 3);
  v_new_attempt := v_row.attempt_count + 1;

  -- Soft-fail when attempts exhausted; caller should template-fallback / ops (design §6.4).
  if v_new_attempt > v_max_attempts then
    return jsonb_build_object(
      'ok', false,
      'reason', 'MAX_ATTEMPTS_EXCEEDED',
      'attempt_count', v_row.attempt_count,
      'max_attempts', v_max_attempts
    );
  end if;

  v_base := public.platform_constant_int('enrichment_retry_base_seconds', 30);
  -- Cap exponent by max_attempts so 2^n cannot overflow even if constant is raised.
  v_exponent := least(v_new_attempt, v_max_attempts);
  -- next_attempt_at = now() + base * 2^attempt_count + jitter(0 .. base), clamped
  v_jitter := floor(random() * (v_base + 1))::int;
  v_delay_seconds := least(
    ((v_base::bigint * (2 ^ v_exponent)::bigint) + v_jitter)::bigint,
    v_max_delay_seconds::bigint
  )::int;
  v_next := now() + make_interval(secs => v_delay_seconds);

  update public.service_request_enrichments
  set
    status = 'PENDING'::public.enrichment_status,
    attempt_count = v_new_attempt,
    next_attempt_at = v_next,
    lease_owner = null,
    locked_until = null,
    last_error_code = nullif(btrim(p_error_code), ''),
    last_error_message = nullif(btrim(p_error_message), ''),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.enrichment_append_event(
    v_row.id,
    'RETRY',
    'enrichment_schedule_retry',
    'PENDING'::public.enrichment_status,
    'RUNNING'::public.enrichment_status,
    v_row.correlation_id,
    jsonb_build_object(
      'attempt_count', v_new_attempt,
      'next_attempt_at', v_next,
      'delay_seconds', v_delay_seconds,
      'error_code', v_row.last_error_code,
      'error_message', v_row.last_error_message
    )
  );

  return jsonb_build_object(
    'ok', true,
    'enrichment_id', v_row.id,
    'attempt_count', v_row.attempt_count,
    'next_attempt_at', v_row.next_attempt_at
  );
end;
$$;

comment on function public.enrichment_schedule_retry(uuid, text, bigint, text, text) is
  'Release RUNNING lease → PENDING with attempt++ and exp backoff+jitter (clamped; max_attempts soft-fail). service_role only.';

revoke all on function public.enrichment_schedule_retry(uuid, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.enrichment_schedule_retry(uuid, text, bigint, text, text)
  to service_role;
