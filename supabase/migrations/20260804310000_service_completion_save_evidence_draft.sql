-- Service completion Task 31: service_completion_save_evidence_draft (design §4.9 / Req 9).
-- Provider-only DEFINER upsert; optimistic draft_version CAS; incomplete drafts allowed.

create or replace function public.service_completion_save_evidence_draft(
  p_contracted_service_id uuid,
  p_responses jsonb,
  p_expected_draft_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_provider_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_evidence public.contracted_service_completion_evidence%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_schema_hash text;
  v_new_version int;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for service_completion_save_evidence_draft'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    raise exception 'p_responses must be a JSON object'
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

  if v_cs.status is distinct from 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  -- Bind READY enrichment schema when available (publication gate already passed for CONFIRMED).
  select e.*
  into v_enrichment
  from public.service_request_enrichments e
  where e.service_request_id = v_cs.service_request_id
    and e.status = 'READY'::public.enrichment_status
    and e.checklist_schema is not null
  limit 1;

  if found then
    v_schema_hash := encode(
      extensions.digest(convert_to(v_enrichment.checklist_schema::text, 'UTF8'), 'sha256'),
      'hex'
    );
  end if;

  select ev.*
  into v_evidence
  from public.contracted_service_completion_evidence ev
  where ev.contracted_service_id = p_contracted_service_id
  for update;

  if not found then
    -- First draft: expected version must be null or 0 (no prior row).
    if p_expected_draft_version is not null and p_expected_draft_version <> 0 then
      raise exception 'DRAFT_VERSION_CONFLICT'
        using errcode = 'P0001';
    end if;

    insert into public.contracted_service_completion_evidence (
      contracted_service_id,
      enrichment_id,
      checklist_schema_hash,
      phase,
      responses,
      draft_version
    )
    values (
      p_contracted_service_id,
      v_enrichment.id,
      v_schema_hash,
      'draft'::public.completion_evidence_phase,
      p_responses,
      1
    )
    returning * into v_evidence;

    raise log
      'service_completion_save_evidence_draft created cs_id=% draft_version=% enrichment_id=%',
      p_contracted_service_id,
      v_evidence.draft_version,
      v_evidence.enrichment_id;

    return jsonb_build_object(
      'ok', true,
      'contracted_service_id', p_contracted_service_id,
      'evidence_id', v_evidence.id,
      'draft_version', v_evidence.draft_version,
      'phase', v_evidence.phase,
      'enrichment_id', v_evidence.enrichment_id,
      'checklist_schema_hash', v_evidence.checklist_schema_hash
    );
  end if;

  if v_evidence.phase is distinct from 'draft'::public.completion_evidence_phase then
    raise exception 'EVIDENCE_NOT_DRAFT'
      using errcode = 'P0001';
  end if;

  if p_expected_draft_version is null
    or p_expected_draft_version is distinct from v_evidence.draft_version
  then
    raise exception 'DRAFT_VERSION_CONFLICT'
      using errcode = 'P0001',
            detail = format(
              'expected=%s actual=%s',
              p_expected_draft_version,
              v_evidence.draft_version
            );
  end if;

  v_new_version := v_evidence.draft_version + 1;

  update public.contracted_service_completion_evidence
  set
    responses = p_responses,
    draft_version = v_new_version,
    enrichment_id = coalesce(enrichment_id, v_enrichment.id),
    checklist_schema_hash = coalesce(checklist_schema_hash, v_schema_hash),
    updated_at = now()
  where id = v_evidence.id
  returning * into v_evidence;

  raise log
    'service_completion_save_evidence_draft updated cs_id=% draft_version=%',
    p_contracted_service_id,
    v_evidence.draft_version;

  return jsonb_build_object(
    'ok', true,
    'contracted_service_id', p_contracted_service_id,
    'evidence_id', v_evidence.id,
    'draft_version', v_evidence.draft_version,
    'phase', v_evidence.phase,
    'enrichment_id', v_evidence.enrichment_id,
    'checklist_schema_hash', v_evidence.checklist_schema_hash
  );
end;
$$;

comment on function public.service_completion_save_evidence_draft(uuid, jsonb, int) is
  'Provider upsert of completion evidence draft while CS CONFIRMED; optimistic draft_version CAS; incomplete responses allowed (Task 31 / design §4.9).';

revoke all on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  from public;
revoke all on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  from anon;
revoke all on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  from service_role;

grant execute on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  to authenticated;
grant execute on function public.service_completion_save_evidence_draft(uuid, jsonb, int)
  to postgres;
