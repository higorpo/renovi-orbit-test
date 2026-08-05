-- Service completion Task 15: republish_cancelled_service_request enqueues enrichment
-- (design §4.11). MUST NOT bootstrap matching; MUST NOT copy source enrichment/checklist/evidence.
-- Full republish pgTAP suite: Task 67.

create or replace function public.republish_cancelled_service_request(
  p_service_request_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_source public.service_requests%rowtype;
  v_new public.service_requests%rowtype;
  v_cached jsonb;
  v_request_hash text;
  v_is_cancelled boolean;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for republish_cancelled_service_request'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  v_request_hash := md5(p_service_request_id::text);

  v_cached := public.idempotency_begin(
    'view_services.republish_cancelled_service_request',
    p_idempotency_key,
    v_request_hash
  );

  if v_cached is not null then
    return v_cached->'response_body';
  end if;

  select *
  into v_source
  from public.service_requests sr
  where sr.id = p_service_request_id
  for update;

  if not found then
    raise exception 'Service request not found: %', p_service_request_id
      using errcode = '22023';
  end if;

  if v_actor <> v_source.client_id then
    raise exception 'Only the service request client may republish'
      using errcode = '42501';
  end if;

  v_is_cancelled :=
    v_source.status = 'CANCELLED'::public.service_request_status
    or exists (
      select 1
      from public.contracted_services cs
      where cs.service_request_id = v_source.id
        and cs.status = 'CANCELLED'::public.contracted_service_status
    );

  if not v_is_cancelled then
    raise exception 'SR_NOT_CANCELLED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'SR_NOT_CANCELLED')::text;
  end if;

  if v_source.address_id is null
    or not exists (
      select 1
      from public.client_addresses ca
      where ca.id = v_source.address_id
        and ca.client_id = v_actor
        and ca.is_active = true
    )
  then
    raise exception 'address does not belong to actor or is inactive'
      using errcode = '42501';
  end if;

  if v_source.service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(v_source.description), '') is null then
    raise exception 'p_description is required'
      using errcode = '22023';
  end if;

  insert into public.service_requests (
    client_id,
    service_id,
    address_id,
    title,
    description,
    photos,
    form_data,
    form_schema,
    form_version,
    status,
    urgency,
    scope_complexity,
    tags,
    missing_info_warnings,
    suggested_equipment,
    suggested_materials,
    estimated_duration_hint
  )
  values (
    v_source.client_id,
    v_source.service_id,
    v_source.address_id,
    coalesce(nullif(btrim(v_source.title), ''), 'Pedido de serviço'),
    btrim(v_source.description),
    v_source.photos,
    v_source.form_data,
    v_source.form_schema,
    v_source.form_version,
    'OPEN'::public.service_request_status,
    v_source.urgency,
    v_source.scope_complexity,
    v_source.tags,
    v_source.missing_info_warnings,
    v_source.suggested_equipment,
    v_source.suggested_materials,
    v_source.estimated_duration_hint
  )
  returning * into v_new;

  -- Fresh enrichment FSM for the new SR only — never copy source enrichment/checklist/evidence.
  -- Matching bootstrap only on READY finalize (OPEN trigger dropped in Task 12).
  perform public.service_request_enqueue_enrichment(v_new.id, p_idempotency_key);

  v_response := jsonb_build_object(
    'requestId', v_new.id,
    'sourceRequestId', v_source.id
  );

  perform public.idempotency_commit(
    'view_services.republish_cancelled_service_request',
    p_idempotency_key,
    v_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

comment on function public.republish_cancelled_service_request(uuid, uuid) is
  'Client duplicates a cancelled service request into a new OPEN row; reuses photo paths; enqueues enrichment via service_request_enqueue_enrichment; MUST NOT bootstrap matching.';
