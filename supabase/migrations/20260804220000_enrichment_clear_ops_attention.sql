-- Service completion Task 22: enrichment_clear_ops_attention (design §4.8).
-- MUST NOT READY by itself — worker/finalize materializes after reclaim claim.

create or replace function public.enrichment_clear_ops_attention(
  p_enrichment_id uuid,
  p_rearm_next_attempt boolean default true,
  p_actor text default 'ops',
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
  v_prior_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_clear_ops_attention'
      using errcode = '42501';
  end if;

  if p_enrichment_id is null then
    raise exception 'p_enrichment_id is required'
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

  if v_row.ops_attention_at is null then
    return jsonb_build_object('ok', true, 'noop', true, 'reason', 'NO_OPS_ATTENTION');
  end if;

  if v_row.status not in (
    'PENDING'::public.enrichment_status,
    'RUNNING'::public.enrichment_status
  ) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'INVALID_STATUS',
      'status', v_row.status
    );
  end if;

  v_prior_reason := v_row.ops_attention_reason;

  update public.service_request_enrichments
  set
    ops_attention_at = null,
    ops_attention_reason = null,
    status = 'PENDING'::public.enrichment_status,
    next_attempt_at = case
      when coalesce(p_rearm_next_attempt, true) then now()
      else null
    end,
    lease_owner = null,
    locked_until = null,
    correlation_id = coalesce(p_correlation_id, correlation_id),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.enrichment_append_event(
    v_row.id,
    'OPS_ATTENTION_CLEARED',
    coalesce(nullif(btrim(p_actor), ''), 'ops'),
    'PENDING'::public.enrichment_status,
    'PENDING'::public.enrichment_status,
    v_row.correlation_id,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
      'prior_reason', v_prior_reason,
      'rearm_next_attempt', coalesce(p_rearm_next_attempt, true),
      'next_attempt_at', v_row.next_attempt_at
    )
  );

  raise log
    'enrichment_clear_ops_attention enrichment_id=% prior_reason=% rearm=%',
    v_row.id,
    v_prior_reason,
    coalesce(p_rearm_next_attempt, true);

  return jsonb_build_object(
    'ok', true,
    'enrichment_id', v_row.id,
    'service_request_id', v_row.service_request_id,
    'next_attempt_at', v_row.next_attempt_at
  );
end;
$$;

comment on function public.enrichment_clear_ops_attention(uuid, boolean, text, uuid, jsonb) is
  'Clear ops_attention hold and optionally re-arm next_attempt_at for claim. Does not READY. service_role only (ops role grant optional later).';

revoke all on function public.enrichment_clear_ops_attention(uuid, boolean, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.enrichment_clear_ops_attention(uuid, boolean, text, uuid, jsonb)
  to service_role;
