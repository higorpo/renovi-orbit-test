-- Service completion Task 45: get_service_completion_context read-model (design §5.10).
-- Visibility entry aligns with get_service via service_viewer_has_access (or platform admin).
-- Full checklist_schema + CS participant ids: owning client, contracted provider, or admin only.
-- Marketplace-only viewers get a limited status payload (no schema scrape / no counterparty ids).
-- Exposure matrix pgTAP: Task 60.

create or replace function public.get_service_completion_context(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_sr public.service_requests%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_cs public.contracted_services%rowtype;
  v_evidence public.contracted_service_completion_evidence%rowtype;
  v_has_enrichment boolean := false;
  v_has_cs boolean := false;
  v_has_evidence boolean := false;
  v_is_client_owner boolean := false;
  v_is_contracted_provider boolean := false;
  v_is_platform_admin boolean := false;
  v_is_full_detail boolean := false;
  v_enrichment_ready boolean := false;
  v_include_schema boolean := false;
  v_include_responses boolean := false;
  v_responses jsonb := null;
  v_phase text := 'absent';
  v_has_rating boolean := false;
  v_enrichment_json jsonb;
  v_cs_json jsonb;
  v_evidence_json jsonb;
  v_capabilities jsonb;
begin
  if v_viewer_id is null then
    raise exception 'Authentication required for get_service_completion_context'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  v_is_platform_admin := coalesce(public.is_platform_admin(), false);

  -- Entry: marketplace viewer access OR platform admin (admin may lack feed visibility).
  if not v_is_platform_admin
    and not public.service_viewer_has_access(p_service_request_id, v_viewer_id)
  then
    raise exception 'Service not found or access denied'
      using errcode = '42501';
  end if;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id;

  if not found then
    raise exception 'Service not found'
      using errcode = 'P0002';
  end if;

  v_is_client_owner := (v_sr.client_id = v_viewer_id);

  select e.*
  into v_enrichment
  from public.service_request_enrichments e
  where e.service_request_id = p_service_request_id;
  v_has_enrichment := found;

  if v_has_enrichment then
    v_enrichment_ready := (v_enrichment.status = 'READY'::public.enrichment_status);
  end if;

  if v_sr.contracted_service_id is not null then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.id = v_sr.contracted_service_id;
    v_has_cs := found;
  end if;

  if not v_has_cs then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.service_request_id = p_service_request_id
    order by cs.created_at desc
    limit 1;
    v_has_cs := found;
  end if;

  if v_has_cs then
    v_is_contracted_provider := (v_cs.provider_id = v_viewer_id);

    select ev.*
    into v_evidence
    from public.contracted_service_completion_evidence ev
    where ev.contracted_service_id = v_cs.id;
    v_has_evidence := found;

    v_has_rating := exists (
      select 1
      from public.service_ratings r
      where r.contracted_service_id = v_cs.id
    );
  end if;

  -- Full detail: SR client, CS provider, or platform admin — not raw marketplace viewers.
  v_is_full_detail := (
    v_is_client_owner
    or v_is_contracted_provider
    or v_is_platform_admin
  );

  v_include_schema := v_enrichment_ready and v_is_full_detail;

  if v_has_evidence then
    v_phase := v_evidence.phase::text;

    if v_evidence.phase = 'frozen'::public.completion_evidence_phase
      and (v_is_client_owner or v_is_contracted_provider or v_is_platform_admin)
    then
      v_include_responses := true;
      v_responses := v_evidence.responses;
    elsif v_evidence.phase = 'draft'::public.completion_evidence_phase
      and (v_is_contracted_provider or v_is_platform_admin)
    then
      -- Provider draft only — never expose draft responses to clients
      v_include_responses := true;
      v_responses := v_evidence.responses;
    end if;
  end if;

  if v_has_enrichment then
    if v_is_full_detail then
      v_enrichment_json := jsonb_build_object(
        'status', v_enrichment.status,
        'source', v_enrichment.source,
        'materialized_at', v_enrichment.materialized_at,
        'ops_attention', (v_enrichment.ops_attention_at is not null),
        'schema_version', v_enrichment.schema_version
      );
      if v_include_schema then
        v_enrichment_json := v_enrichment_json
          || jsonb_build_object('checklist_schema', v_enrichment.checklist_schema);
      end if;
    else
      -- Marketplace-only: status flags + ready boolean; no schema / ops internals.
      v_enrichment_json := jsonb_build_object(
        'status', v_enrichment.status,
        'ready', v_enrichment_ready
      );
    end if;
  else
    v_enrichment_json := null;
  end if;

  if v_has_cs then
    if v_is_full_detail then
      v_cs_json := jsonb_build_object(
        'id', v_cs.id,
        'status', v_cs.status,
        'executed_at', v_cs.executed_at,
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by,
        'provider_id', v_cs.provider_id,
        'client_id', v_cs.client_id
      );
    else
      -- No counterparty user ids for non-participants.
      v_cs_json := jsonb_build_object(
        'id', v_cs.id,
        'status', v_cs.status,
        'executed_at', v_cs.executed_at,
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by
      );
    end if;
  else
    v_cs_json := jsonb_build_object(
      'id', null,
      'status', null,
      'executed_at', null,
      'completed_at', null,
      'completed_by', null
    );
  end if;

  if v_is_full_detail then
    v_evidence_json := jsonb_build_object(
      'phase', v_phase,
      'frozen_at', case when v_has_evidence then v_evidence.frozen_at else null end,
      'auto_executed_without_checklist',
        case
          when v_has_evidence then v_evidence.auto_executed_without_checklist
          else false
        end,
      'draft_version', case
        when v_has_evidence and (v_is_contracted_provider or v_is_platform_admin)
        then v_evidence.draft_version
        else null
      end
    );

    if v_include_responses then
      v_evidence_json := v_evidence_json || jsonb_build_object('responses', v_responses);
    end if;
  else
    -- Marketplace-only: phase flag without evidence body.
    v_evidence_json := jsonb_build_object(
      'phase', v_phase,
      'frozen_at', null,
      'auto_executed_without_checklist', null,
      'draft_version', null
    );
  end if;

  v_capabilities := jsonb_build_object(
    'can_mark_executed',
      v_is_contracted_provider
      and v_has_cs
      and v_cs.status = 'CONFIRMED'::public.contracted_service_status
      and v_enrichment_ready,
    'can_save_draft',
      v_is_contracted_provider
      and v_has_cs
      and v_cs.status = 'CONFIRMED'::public.contracted_service_status
      and v_enrichment_ready
      and (
        not v_has_evidence
        or v_evidence.phase = 'draft'::public.completion_evidence_phase
      ),
    'can_confirm_with_rating',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'EXECUTED'::public.contracted_service_status,
    'can_submit_optional_rating',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'COMPLETED'::public.contracted_service_status
      and v_cs.completed_by = 'system'
      and not v_has_rating,
    'show_dispute_stub',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'EXECUTED'::public.contracted_service_status
  );

  raise log
    'get_service_completion_context sr_id=% viewer=% client_owner=% contracted_provider=% full_detail=% enrichment_ready=%',
    p_service_request_id,
    v_viewer_id,
    v_is_client_owner,
    v_is_contracted_provider,
    v_is_full_detail,
    v_enrichment_ready;

  return jsonb_build_object(
    'service_request_id', p_service_request_id,
    'enrichment', v_enrichment_json,
    'contracted_service', v_cs_json,
    'evidence', v_evidence_json,
    'capabilities', v_capabilities
  );
end;
$$;

comment on function public.get_service_completion_context(uuid) is
  'Authorized completion/enrichment read-model (Task 45 / §5.10). Full schema + participant ids for SR client, CS provider, or admin; marketplace viewers get limited status payload only.';

revoke all on function public.get_service_completion_context(uuid) from public;
revoke all on function public.get_service_completion_context(uuid) from anon;
revoke all on function public.get_service_completion_context(uuid) from service_role;

grant execute on function public.get_service_completion_context(uuid) to authenticated;
grant execute on function public.get_service_completion_context(uuid) to postgres;
