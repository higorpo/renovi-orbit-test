-- Service completion Task 14: wire create_request_quote_service_request → enqueue enrichment
-- (design §4.1.1). MUST NOT call matching bootstrap. Same TX as SR insert.

-- Drop Task 13 single-arg signature so defaulted 2-arg is the only overload.
drop function if exists public.service_request_enqueue_enrichment(uuid);

-- Optional correlation_id (idempotency key from create path).
create or replace function public.service_request_enqueue_enrichment(
  p_service_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  insert into public.service_request_enrichments (
    service_request_id,
    status,
    attempt_count,
    next_attempt_at,
    correlation_id
  )
  values (
    p_service_request_id,
    'PENDING'::public.enrichment_status,
    0,
    null,
    v_correlation_id
  )
  on conflict (service_request_id) do nothing;

  raise log
    'service_request_enqueue_enrichment pending service_request_id=% correlation_id=%',
    p_service_request_id,
    v_correlation_id;

  if public.orbit_internal_edge_invoke_is_configured() then
    begin
      perform public.orbit_invoke_edge_function(
        'generate-completion-checklist',
        jsonb_build_object(
          'reason', 'enqueue_wake',
          'service_request_id', p_service_request_id
        ),
        60000
      );
    exception
      when others then
        raise warning
          'service_request_enqueue_enrichment wake generate-completion-checklist failed: %',
          sqlerrm;
    end;
  end if;
end;
$$;

comment on function public.service_request_enqueue_enrichment(uuid, uuid) is
  'Insert PENDING enrichment UNIQUE(service_request_id) ON CONFLICT DO NOTHING; optional correlation_id (e.g. create idempotency key); best-effort wake generate-completion-checklist.';

revoke all on function public.service_request_enqueue_enrichment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to service_role;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to postgres;

-- Keep single-arg overload grants (Postgres treats defaulted 2-arg as one function).
-- Signature after replace is (uuid, uuid) with default — identity args still (uuid) for 1-arg calls.

create or replace function public.create_request_quote_service_request(
  p_actor_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_address_id uuid,
  p_service_id uuid,
  p_request_title text,
  p_description text,
  p_photo_urls text[],
  p_form_data jsonb,
  p_form_schema jsonb,
  p_form_version text,
  p_urgency text,
  p_scope_complexity text,
  p_tags text[],
  p_missing_info_warnings text[],
  p_suggested_equipment text[],
  p_suggested_materials text[],
  p_estimated_duration_hint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sr public.service_requests%rowtype;
  v_response jsonb;
begin
  if p_actor_user_id is null then
    raise exception 'p_actor_user_id is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_request_hash), '') is null then
    raise exception 'p_request_hash is required'
      using errcode = '22023';
  end if;

  if p_service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_description), '') is null then
    raise exception 'p_description is required'
      using errcode = '22023';
  end if;

  if p_address_id is null then
    raise exception 'p_address_id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.client_addresses ca
    where ca.id = p_address_id
      and ca.client_id = p_actor_user_id
      and ca.is_active = true
  ) then
    raise exception 'address does not belong to actor or is inactive'
      using errcode = '42501';
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
    p_actor_user_id,
    p_service_id,
    p_address_id,
    coalesce(nullif(btrim(p_request_title), ''), 'Pedido de serviço'),
    btrim(p_description),
    case
      when p_photo_urls is not null and cardinality(p_photo_urls) > 0 then p_photo_urls
      else null
    end,
    p_form_data,
    p_form_schema,
    nullif(btrim(p_form_version), ''),
    'OPEN'::public.service_request_status,
    nullif(btrim(p_urgency), ''),
    nullif(btrim(p_scope_complexity), ''),
    p_tags,
    p_missing_info_warnings,
    p_suggested_equipment,
    p_suggested_materials,
    nullif(btrim(p_estimated_duration_hint), '')
  )
  returning * into v_sr;

  -- Publication readiness: PENDING enrichment in same TX; matching bootstrap only on READY.
  perform public.service_request_enqueue_enrichment(v_sr.id, p_idempotency_key);

  v_response := jsonb_build_object(
    'requestId', v_sr.id,
    'addressId', p_address_id
  );

  perform public.idempotency_commit_for_actor(
    p_actor_user_id,
    'request_quote.create_order',
    p_idempotency_key,
    p_request_hash,
    200,
    v_response
  );

  return v_response;
end;
$$;

comment on function public.create_request_quote_service_request(
  uuid, uuid, text, uuid, uuid, text, text, text[], jsonb, jsonb, text, text, text, text[], text[], text[], text[], text
) is
  'Inserts OPEN service_request after address ownership check; enqueues enrichment PENDING (no matching bootstrap); commits request_quote.create_order idempotency (service_role via Edge).';
