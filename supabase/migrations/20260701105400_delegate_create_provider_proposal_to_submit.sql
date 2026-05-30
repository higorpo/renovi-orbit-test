-- CNS Wave D — task 57: legacy create_provider_proposal delegates to submit_proposal (design §Schema evolution).

create or replace function public._legacy_bridge_idempotency_uuid(p_seed text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select (
    substr(md5(p_seed), 1, 8) || '-' ||
    substr(md5(p_seed), 9, 4) || '-' ||
    '4' || substr(md5(p_seed), 13, 3) || '-' ||
    substr(
      '89ab',
      (get_byte(decode(substr(md5(p_seed), 16, 2), 'hex'), 0) >> 6) + 1,
      1
    ) ||
    substr(md5(p_seed), 17, 3) || '-' ||
    substr(md5(p_seed), 21, 12)
  )::uuid;
$$;

comment on function public._legacy_bridge_idempotency_uuid(text) is
  'Deterministic UUID v4-shaped key for legacy RPC idempotency bridging (task 57).';

create or replace function public.create_provider_proposal(
  p_service_request_id uuid,
  p_proposed_amount numeric,
  p_proposal_description text,
  p_proposal_duration_value integer,
  p_proposal_duration_unit text,
  p_proposal_suggested_slots jsonb,
  p_photos text[],
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric,
  p_pricing_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_provider_id uuid := auth.uid();
  v_role text;
  v_chat_id uuid;
  v_idempotency_seed text;
  v_idempotency_key uuid;
  v_initiate_result jsonb;
  v_submit_result jsonb;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for create_provider_proposal'
      using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can create proposals'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select c.id
  into v_chat_id
  from public.chats c
  where c.service_request_id = p_service_request_id
    and c.provider_id = v_provider_id;

  v_idempotency_seed := concat_ws(
    '|',
    'legacy.create_provider_proposal',
    p_service_request_id::text,
    v_provider_id::text,
    round(p_proposed_amount::numeric, 2)::text,
    coalesce(trim(p_proposal_description), ''),
    p_proposal_duration_value::text,
    p_proposal_duration_unit,
    p_proposal_suggested_slots::text,
    p_pricing_signature,
    round(coalesce(p_tax_rate, 0)::numeric, 4)::text,
    round(coalesce(p_tax_amount, 0)::numeric, 2)::text,
    round(coalesce(p_final_amount, 0)::numeric, 2)::text,
    coalesce(array_to_string(p_photos, ','), '')
  );

  v_idempotency_key := public._legacy_bridge_idempotency_uuid(v_idempotency_seed);

  if v_chat_id is null then
    v_initiate_result := public.cns_initiate_conversation(
      p_service_request_id,
      public._legacy_bridge_idempotency_uuid('legacy.initiate:' || v_idempotency_seed)
    );

    v_chat_id := (v_initiate_result->'conversation'->>'id')::uuid;
  end if;

  raise log 'cns_create_provider_proposal_deprecated_total service_request_id=% provider_id=% chat_id=%',
    p_service_request_id,
    v_provider_id,
    v_chat_id;

  v_submit_result := public.submit_proposal(
    v_chat_id,
    v_idempotency_key,
    p_proposed_amount,
    p_proposal_description,
    p_proposal_duration_value,
    p_proposal_duration_unit,
    p_proposal_suggested_slots,
    p_pricing_signature,
    p_tax_rate,
    p_tax_amount,
    p_final_amount,
    coalesce(p_photos, '{}'::text[])
  );

  return jsonb_build_object(
    'id', v_submit_result->'proposal'->>'id'
  );
end;
$$;

comment on function public.create_provider_proposal(
  uuid,
  numeric,
  text,
  integer,
  text,
  jsonb,
  text[],
  numeric,
  numeric,
  numeric,
  text
) is
  'Deprecated legacy wrapper; delegates to submit_proposal (Wave D). Prefer submit_proposal for new clients.';

revoke all on function public._legacy_bridge_idempotency_uuid(text) from public;
revoke all on function public._legacy_bridge_idempotency_uuid(text) from authenticated;
revoke all on function public._legacy_bridge_idempotency_uuid(text) from anon;

revoke all on function public.create_provider_proposal(
  uuid,
  numeric,
  text,
  integer,
  text,
  jsonb,
  text[],
  numeric,
  numeric,
  numeric,
  text
) from public;
revoke all on function public.create_provider_proposal(
  uuid,
  numeric,
  text,
  integer,
  text,
  jsonb,
  text[],
  numeric,
  numeric,
  numeric,
  text
) from anon;

grant execute on function public.create_provider_proposal(
  uuid,
  numeric,
  text,
  integer,
  text,
  jsonb,
  text[],
  numeric,
  numeric,
  numeric,
  text
) to authenticated;
