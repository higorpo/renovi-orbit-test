-- Service completion Task 35: service_completion_mark_executed + response validation (design §5.4 / §5.8).
-- Product writer outside payments (ADR-0004). pgTAP suites: Tasks 69–70.

-- ---------------------------------------------------------------------------
-- Validate responses map against READY checklist schema (Req 13).
-- ---------------------------------------------------------------------------
create or replace function public.service_completion_validate_evidence_responses(
  p_schema jsonb,
  p_responses jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_block jsonb;
  v_id text;
  v_answer jsonb;
  v_met boolean;
  v_justification text;
  v_paths jsonb;
  v_path_count int;
  v_config jsonb;
  v_requires_when_met boolean;
  v_ev_min int;
  v_ev_max int;
  v_ev_min_default int;
  v_ev_max_default int;
  v_criterion_count int := 0;
begin
  if p_schema is null or jsonb_typeof(p_schema) <> 'object' then
    return false;
  end if;

  if p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    return false;
  end if;

  v_ev_min_default := public.platform_constant_int('checklist_evidence_min', 1);
  v_ev_max_default := public.platform_constant_int('checklist_evidence_max', 5);

  for v_block in
    select value
    from jsonb_array_elements(coalesce(p_schema -> 'blocks', '[]'::jsonb))
  loop
    if coalesce(v_block ->> 'type', '') <> 'completion_criterion' then
      continue;
    end if;

    v_criterion_count := v_criterion_count + 1;
    v_id := nullif(btrim(v_block ->> 'id'), '');
    if v_id is null then
      return false;
    end if;

    v_answer := p_responses -> v_id;
    if v_answer is null or jsonb_typeof(v_answer) <> 'object' then
      return false;
    end if;

    if not (v_answer ? 'met') then
      return false;
    end if;

    begin
      v_met := (v_answer ->> 'met')::boolean;
    exception
      when others then
        return false;
    end;

    v_justification := nullif(btrim(coalesce(v_answer ->> 'justification', '')), '');
    v_paths := coalesce(v_answer -> 'evidence_paths', '[]'::jsonb);
    if jsonb_typeof(v_paths) <> 'array' then
      return false;
    end if;
    v_path_count := jsonb_array_length(v_paths);

    v_config := coalesce(v_block -> 'config', '{}'::jsonb);
    begin
      v_requires_when_met := coalesce((v_config ->> 'requires_evidence_when_met')::boolean, false);
    exception
      when others then
        return false;
    end;

    v_ev_min := v_ev_min_default;
    v_ev_max := v_ev_max_default;
    if v_config ? 'evidence_min' then
      begin
        v_ev_min := (v_config ->> 'evidence_min')::int;
      exception
        when others then
          return false;
      end;
    end if;
    if v_config ? 'evidence_max' then
      begin
        v_ev_max := (v_config ->> 'evidence_max')::int;
      exception
        when others then
          return false;
      end;
    end if;

    if not v_met then
      if v_justification is null then
        return false;
      end if;
      if v_path_count < v_ev_min or v_path_count > v_ev_max then
        return false;
      end if;
    elsif v_requires_when_met then
      if v_path_count < v_ev_min or v_path_count > v_ev_max then
        return false;
      end if;
    end if;
  end loop;

  if v_criterion_count < public.platform_constant_int('checklist_criterion_min', 3) then
    return false;
  end if;

  return true;
end;
$$;

comment on function public.service_completion_validate_evidence_responses(jsonb, jsonb) is
  'Validates completion responses map vs checklist schema (Req 13 / design §5.8.2). Incomplete drafts are not validated here.';

revoke all on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  to service_role;
grant execute on function public.service_completion_validate_evidence_responses(jsonb, jsonb)
  to postgres;

-- ---------------------------------------------------------------------------
-- Mark executed (provider product API)
-- ---------------------------------------------------------------------------
create or replace function public.service_completion_mark_executed(
  p_contracted_service_id uuid,
  p_responses jsonb,
  p_idempotency_key text,
  p_expected_draft_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, message_dispatcher
as $$
declare
  v_provider_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_evidence public.contracted_service_completion_evidence%rowtype;
  v_idem text := nullif(btrim(p_idempotency_key), '');
  v_today date;
  v_executed_late boolean;
  v_schema_hash text;
  v_responses_hash text;
  v_schedule_id uuid;
  v_mmd jsonb;
  v_title text;
  v_path text;
  v_paths text[] := array[]::text[];
begin
  if v_provider_id is null then
    raise exception 'Authentication required for service_completion_mark_executed'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if v_idem is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  -- Reject legacy callers without checklist payload
  if p_responses is null or jsonb_typeof(p_responses) <> 'object'
    or p_responses = '{}'::jsonb
  then
    raise exception 'CHECKLIST_PAYLOAD_REQUIRED'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.provider_id = v_provider_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  -- Idempotent replay: already EXECUTED with same key
  if v_cs.status = 'EXECUTED'::public.contracted_service_status then
    select ev.*
    into v_evidence
    from public.contracted_service_completion_evidence ev
    where ev.contracted_service_id = p_contracted_service_id;

    if found
      and v_evidence.phase = 'frozen'::public.completion_evidence_phase
      and v_evidence.idempotency_key is not distinct from v_idem
    then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'contracted_service_id', p_contracted_service_id,
        'status', 'EXECUTED',
        'executed_at', v_cs.executed_at,
        'executed_late', v_evidence.executed_late,
        'evidence_id', v_evidence.id,
        'responses_hash', v_evidence.responses_hash
      );
    end if;

    raise exception 'ALREADY_EXECUTED'
      using errcode = 'P0001';
  end if;

  if v_cs.status is distinct from 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  v_today := public.service_completion_brt_today();
  if v_today < v_cs.scheduled_start_date then
    raise exception 'SERVICE_NOT_YET_DUE'
      using errcode = 'P0002';
  end if;

  select e.*
  into v_enrichment
  from public.service_request_enrichments e
  where e.service_request_id = v_cs.service_request_id
    and e.status = 'READY'::public.enrichment_status
    and e.checklist_schema is not null
  limit 1;

  if not found then
    raise exception 'CHECKLIST_REQUIRED'
      using errcode = 'P0001';
  end if;

  if not public.service_completion_validate_evidence_responses(
    v_enrichment.checklist_schema,
    p_responses
  ) then
    raise exception 'INVALID_CHECKLIST_RESPONSES'
      using errcode = 'P0001';
  end if;

  v_executed_late := public.service_completion_compute_executed_late(
    v_cs.scheduled_start_date,
    v_cs.scheduled_end_date
  );

  v_schema_hash := encode(
    extensions.digest(convert_to(v_enrichment.checklist_schema::text, 'UTF8'), 'sha256'),
    'hex'
  );
  -- jsonb text form is key-sorted (Postgres jsonb canonicalization)
  v_responses_hash := encode(
    extensions.digest(convert_to(p_responses::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select ev.*
  into v_evidence
  from public.contracted_service_completion_evidence ev
  where ev.contracted_service_id = p_contracted_service_id
  for update;

  if found then
    if v_evidence.phase is distinct from 'draft'::public.completion_evidence_phase then
      raise exception 'EVIDENCE_NOT_DRAFT'
        using errcode = 'P0001';
    end if;

    if p_expected_draft_version is not null
      and p_expected_draft_version is distinct from v_evidence.draft_version
    then
      raise exception 'DRAFT_VERSION_CONFLICT'
        using errcode = 'P0001';
    end if;

    update public.contracted_service_completion_evidence
    set
      enrichment_id = coalesce(enrichment_id, v_enrichment.id),
      checklist_schema_hash = coalesce(checklist_schema_hash, v_schema_hash),
      phase = 'frozen'::public.completion_evidence_phase,
      responses = p_responses,
      responses_hash = v_responses_hash,
      executed_late = v_executed_late,
      frozen_at = now(),
      idempotency_key = v_idem,
      updated_at = now()
    where id = v_evidence.id
    returning * into v_evidence;
  else
    insert into public.contracted_service_completion_evidence (
      contracted_service_id,
      enrichment_id,
      checklist_schema_hash,
      phase,
      responses,
      draft_version,
      executed_late,
      responses_hash,
      frozen_at,
      idempotency_key
    )
    values (
      p_contracted_service_id,
      v_enrichment.id,
      v_schema_hash,
      'frozen'::public.completion_evidence_phase,
      p_responses,
      1,
      v_executed_late,
      v_responses_hash,
      now(),
      v_idem
    )
    returning * into v_evidence;
  end if;

  -- Collect evidence paths from responses; bind only to this CS + provider registry
  for v_path in
    select jsonb_array_elements_text(coalesce(a.value -> 'evidence_paths', '[]'::jsonb))
    from jsonb_each(p_responses) as a(key, value)
  loop
    v_paths := array_append(v_paths, v_path);
  end loop;

  select coalesce(array_agg(distinct p), array[]::text[])
  into v_paths
  from unnest(v_paths) as p;

  if coalesce(array_length(v_paths, 1), 0) > 0 then
    if exists (
      select 1
      from unnest(v_paths) as req(path)
      where not exists (
        select 1
        from public.completion_evidence_upload_objects o
        join public.completion_evidence_upload_sessions s on s.id = o.session_id
        where o.storage_path = req.path
          and s.contracted_service_id = p_contracted_service_id
          and s.provider_id = v_provider_id
      )
    ) then
      raise exception 'EVIDENCE_PATH_NOT_REGISTERED'
        using errcode = 'P0001';
    end if;

    update public.completion_evidence_upload_objects o
    set referenced_in_responses = true
    from public.completion_evidence_upload_sessions s
    where o.session_id = s.id
      and s.contracted_service_id = p_contracted_service_id
      and s.provider_id = v_provider_id
      and o.storage_path = any (v_paths)
      and o.referenced_in_responses = false;
  end if;

  -- Commit open upload sessions in the same TX as freeze / EXECUTED
  update public.completion_evidence_upload_sessions
  set status = 'committed', updated_at = now()
  where contracted_service_id = p_contracted_service_id
    and status = 'open';

  update public.contracted_services cs
  set
    status = 'EXECUTED'::public.contracted_service_status,
    executed_at = now()
  where cs.id = p_contracted_service_id
  returning * into v_cs;

  select ps.id
  into v_schedule_id
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
  order by ps.created_at desc
  limit 1;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_EXECUTED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'CONFIRMED',
      p_to_state := 'EXECUTED',
      p_actor := 'provider'::public.payment_audit_actor,
      p_actor_id := v_provider_id,
      p_metadata := jsonb_build_object(
        'executed_at', v_cs.executed_at,
        'executed_late', v_executed_late,
        'responses_hash', v_responses_hash,
        'evidence_id', v_evidence.id,
        'source', 'service_completion_mark_executed'
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceExecuted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_payload := jsonb_build_object(
        'provider_id', v_cs.provider_id,
        'client_id', v_cs.client_id,
        'executed_at', v_cs.executed_at,
        'executed_late', v_executed_late
      )
    );
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_EXECUTED',
    v_cs.client_id,
    format('service_completion:%s:executed', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'provider_id', v_cs.provider_id,
      'service_request_title', v_title,
      'executed_late', v_executed_late,
      'executed_late_suffix', case when v_executed_late then ' (após o prazo)' else '' end,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_mark_executed'
    )
  );

  raise log
    'service_completion_mark_executed cs_id=% executed_late=% evidence_id=%',
    p_contracted_service_id,
    v_executed_late,
    v_evidence.id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'contracted_service_id', p_contracted_service_id,
    'status', 'EXECUTED',
    'executed_at', v_cs.executed_at,
    'executed_late', v_executed_late,
    'evidence_id', v_evidence.id,
    'responses_hash', v_responses_hash,
    'client_id', v_cs.client_id,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.service_completion_mark_executed(uuid, jsonb, text, int) is
  'Provider marks CONFIRMED CS as EXECUTED: validate checklist responses, freeze evidence, audit, MMD SERVICE_EXECUTED (Task 35 / ADR-0004).';

revoke all on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  from public;
revoke all on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  from anon;
revoke all on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  from service_role;

grant execute on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  to authenticated;
grant execute on function public.service_completion_mark_executed(uuid, jsonb, text, int)
  to postgres;
