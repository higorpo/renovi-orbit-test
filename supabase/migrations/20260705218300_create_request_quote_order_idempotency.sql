-- Request quote order: shared request hash + idempotent service_request insert (operation request_quote.create_order).

create or replace function public.request_quote_order_request_hash(
  p_user_id uuid,
  p_service_id uuid,
  p_address jsonb,
  p_request_title text,
  p_description text,
  p_form_data jsonb,
  p_form_version text,
  p_structured_data jsonb,
  p_photo_count integer,
  p_photo_total_bytes bigint
)
returns text
language sql
immutable
as $$
  select md5(
    concat_ws(
      '|',
      p_user_id::text,
      p_service_id::text,
      coalesce(p_address::text, ''),
      coalesce(p_request_title, ''),
      coalesce(p_description, ''),
      coalesce(p_form_data::text, ''),
      coalesce(p_form_version, ''),
      coalesce(p_structured_data::text, ''),
      coalesce(p_photo_count, 0)::text,
      coalesce(p_photo_total_bytes, 0)::text
    )
  );
$$;

comment on function public.request_quote_order_request_hash(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  jsonb,
  integer,
  bigint
) is
  'Stable md5 request_hash for request_quote.create_order idempotency (Edge + RPC).';

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
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text[],
  jsonb,
  jsonb,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text
) is
  'Inserts OPEN service_request and commits request_quote.create_order idempotency (service_role via Edge).';

revoke all on function public.request_quote_order_request_hash(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  jsonb,
  integer,
  bigint
) from public;
revoke all on function public.request_quote_order_request_hash(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  jsonb,
  integer,
  bigint
) from authenticated;
revoke all on function public.request_quote_order_request_hash(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  jsonb,
  integer,
  bigint
) from anon;

grant execute on function public.request_quote_order_request_hash(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  jsonb,
  text,
  jsonb,
  integer,
  bigint
) to service_role;

revoke all on function public.create_request_quote_service_request(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text[],
  jsonb,
  jsonb,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text
) from public;
revoke all on function public.create_request_quote_service_request(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text[],
  jsonb,
  jsonb,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text
) from authenticated;
revoke all on function public.create_request_quote_service_request(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text[],
  jsonb,
  jsonb,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text
) from anon;

grant execute on function public.create_request_quote_service_request(
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text[],
  jsonb,
  jsonb,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text
) to service_role;
