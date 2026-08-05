-- Service completion Task 20: enrichment_finalize_ready CAS (design §5.3 / §5.3.1).
-- Full race pgTAP (stale/cancel/atomic bootstrap): Tasks 66–68.

create or replace function public.enrichment_finalize_ready(
  p_enrichment_id uuid,
  p_lease_owner text,
  p_lease_generation bigint,
  p_schema jsonb,
  p_source public.checklist_source,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
  v_sr_status public.service_request_status;
  v_event_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_finalize_ready'
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

  if p_source is null then
    raise exception 'p_source is required'
      using errcode = '22023';
  end if;

  if not public.enrichment_validate_checklist_schema(p_schema) then
    raise exception 'INVALID_CHECKLIST_SCHEMA'
      using errcode = 'P0001';
  end if;

  select *
  into v_row
  from public.service_request_enrichments e
  where e.id = p_enrichment_id
  for update of e;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  select sr.status
  into v_sr_status
  from public.service_requests sr
  where sr.id = v_row.service_request_id;

  if v_sr_status = 'CANCELLED'::public.service_request_status then
    perform public.enrichment_abort_for_service_request(
      v_row.service_request_id,
      'enrichment_finalize_ready',
      coalesce(p_correlation_id, v_row.correlation_id),
      jsonb_build_object('reason', 'finalize_saw_cancel')
    );
    return jsonb_build_object('ok', false, 'reason', 'ABORTED');
  end if;

  if v_row.status = 'ABORTED'::public.enrichment_status then
    return jsonb_build_object('ok', false, 'reason', 'ABORTED');
  end if;

  update public.service_request_enrichments e
  set
    status = 'READY'::public.enrichment_status,
    checklist_schema = p_schema,
    -- Stamp DF schema version from AI/template payload (design §3; do not leave null).
    schema_version = (p_schema->>'version')::int,
    source = p_source,
    materialized_at = now(),
    lease_owner = null,
    locked_until = null,
    next_attempt_at = null,
    last_error_code = null,
    last_error_message = null,
    ops_attention_at = null,
    ops_attention_reason = null,
    correlation_id = coalesce(p_correlation_id, e.correlation_id),
    updated_at = now()
  where e.id = p_enrichment_id
    and e.status = 'RUNNING'::public.enrichment_status
    and e.lease_owner = btrim(p_lease_owner)
    and e.lease_generation = p_lease_generation
    and e.checklist_schema is null
  returning * into v_row;

  if not found then
    select *
    into v_row
    from public.service_request_enrichments
    where id = p_enrichment_id;

    if v_row.status = 'READY'::public.enrichment_status
      and v_row.checklist_schema is not null
    then
      perform public.matching_bootstrap_dispatch_for_service_request(v_row.service_request_id);
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'service_request_id', v_row.service_request_id
      );
    end if;

    return jsonb_build_object('ok', false, 'reason', 'STALE_LEASE_OR_STATE');
  end if;

  v_event_type := case
    when p_source = 'fallback_template'::public.checklist_source then 'FALLBACK_APPLIED'
    else 'READY'
  end;

  perform public.enrichment_append_event(
    v_row.id,
    v_event_type,
    'enrichment_finalize_ready',
    'READY'::public.enrichment_status,
    'RUNNING'::public.enrichment_status,
    v_row.correlation_id,
    jsonb_build_object(
      'source', p_source,
      'schema_version', v_row.schema_version
    )
  );

  perform public.matching_bootstrap_dispatch_for_service_request(v_row.service_request_id);

  return jsonb_build_object(
    'ok', true,
    'service_request_id', v_row.service_request_id,
    'enrichment_id', v_row.id,
    'source', p_source
  );
end;
$$;

comment on function public.enrichment_finalize_ready(
  uuid, text, bigint, jsonb, public.checklist_source, uuid
) is
  'CAS finalize RUNNING→READY with schema+source; append READY/FALLBACK_APPLIED; matching_bootstrap same TX. service_role only.';

revoke all on function public.enrichment_finalize_ready(
  uuid, text, bigint, jsonb, public.checklist_source, uuid
) from public, anon, authenticated;
grant execute on function public.enrichment_finalize_ready(
  uuid, text, bigint, jsonb, public.checklist_source, uuid
) to service_role;
