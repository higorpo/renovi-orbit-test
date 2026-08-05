-- Service completion Task 21: enrichment_mark_ops_attention (design §4.8 / decision 19).
-- Claim-skip coverage: Task 17 + Task 71.

create or replace function public.enrichment_mark_ops_attention(
  p_enrichment_id uuid,
  p_reason text,
  p_lease_owner text default null,
  p_lease_generation bigint default null,
  p_correlation_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
  v_from public.enrichment_status;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_mark_ops_attention'
      using errcode = '42501';
  end if;

  if p_enrichment_id is null then
    raise exception 'p_enrichment_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'p_reason is required'
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

  if v_row.status = 'READY'::public.enrichment_status then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_READY');
  end if;

  if v_row.status = 'ABORTED'::public.enrichment_status then
    return jsonb_build_object('ok', false, 'reason', 'ABORTED');
  end if;

  -- Optional lease CAS when caller still holds RUNNING ownership
  if v_row.status = 'RUNNING'::public.enrichment_status then
    if p_lease_owner is not null
      and (
        v_row.lease_owner is distinct from btrim(p_lease_owner)
        or v_row.lease_generation is distinct from p_lease_generation
      )
    then
      return jsonb_build_object('ok', false, 'reason', 'STALE_LEASE_OR_STATE');
    end if;
  end if;

  v_from := v_row.status;

  update public.service_request_enrichments
  set
    status = 'PENDING'::public.enrichment_status,
    next_attempt_at = null,
    lease_owner = null,
    locked_until = null,
    ops_attention_at = coalesce(ops_attention_at, now()),
    ops_attention_reason = btrim(p_reason),
    last_error_code = coalesce(nullif(btrim(p_reason), ''), last_error_code),
    correlation_id = coalesce(p_correlation_id, correlation_id),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.enrichment_append_event(
    v_row.id,
    'OPS_ATTENTION',
    'enrichment_mark_ops_attention',
    'PENDING'::public.enrichment_status,
    v_from,
    v_row.correlation_id,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
      'ops_attention_reason', v_row.ops_attention_reason,
      'severity', 'CRITICAL'
    )
  );

  -- CRITICAL metric/alert emission: Task 56 (Sentry bridge).
  raise log
    'enrichment_ops_attention CRITICAL enrichment_id=% service_request_id=% reason=%',
    v_row.id,
    v_row.service_request_id,
    v_row.ops_attention_reason;

  return jsonb_build_object(
    'ok', true,
    'enrichment_id', v_row.id,
    'service_request_id', v_row.service_request_id,
    'ops_attention_reason', v_row.ops_attention_reason,
    'ops_attention_at', v_row.ops_attention_at
  );
end;
$$;

comment on function public.enrichment_mark_ops_attention(
  uuid, text, text, bigint, uuid, jsonb
) is
  'Hold enrichment PENDING with ops_attention (no READY/bootstrap). Claim skips while set. Reasons: TEMPLATE_CASCADE_MISSING, TEMPLATE_INVALID, …. service_role only.';

revoke all on function public.enrichment_mark_ops_attention(
  uuid, text, text, bigint, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_mark_ops_attention(
  uuid, text, text, bigint, uuid, jsonb
) to service_role;
