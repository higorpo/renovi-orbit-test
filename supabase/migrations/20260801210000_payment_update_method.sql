-- Payment Task 23: payment_update_method RPC (design.md §4.4.2).

create or replace function public.payment_verify_installment_selection_hmac(
  p_submitted_hmac text,
  p_payload jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = public, vault, extensions
as $$
declare
  v_secret text;
  v_computed_hex text;
  v_submitted_hex text;
  v_expires_at timestamptz;
begin
  if p_submitted_hmac is null or trim(p_submitted_hmac) = '' then
    raise exception 'INSTALLMENT_HMAC_REQUIRED'
      using
        errcode = '22023',
        detail = jsonb_build_object('code', 'INSTALLMENT_HMAC_REQUIRED')::text;
  end if;

  if p_payload is null
    or p_payload->>'proposal_id' is null
    or p_payload->>'service_id' is null
    or p_payload->'installment_options' is null then
    raise exception 'INSTALLMENT_HMAC_PAYLOAD_INVALID'
      using errcode = '22023';
  end if;

  v_expires_at := (p_payload->>'expires_at')::timestamptz;
  if v_expires_at is null or v_expires_at < clock_timestamp() then
    raise exception 'INSTALLMENT_SIGNATURE_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INSTALLMENT_SIGNATURE_EXPIRED')::text;
  end if;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'installment_signing_secret';

  if v_secret is null or trim(v_secret) = '' then
    raise exception 'Installment signing secret is not configured in vault';
  end if;

  v_computed_hex := encode(
    extensions.hmac(
      public.payment_installment_hmac_canonical_text(p_payload),
      v_secret::text,
      'sha256'::text
    ),
    'hex'
  );
  v_submitted_hex := lower(trim(p_submitted_hmac));

  if encode(extensions.digest(v_computed_hex, 'sha256'), 'hex')
    <> encode(extensions.digest(v_submitted_hex, 'sha256'), 'hex') then
    raise exception 'INVALID_INSTALLMENT_SIGNATURE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INVALID_INSTALLMENT_SIGNATURE')::text;
  end if;
end;
$$;

comment on function public.payment_verify_installment_selection_hmac(text, jsonb) is
  'Verifies installment selection HMAC using canonical payload serialization.';

create or replace function public.payment_assert_installment_hmac_context(
  p_submitted_hmac text,
  p_payload jsonb,
  p_proposal_id uuid,
  p_service_id uuid,
  p_installment_number smallint,
  p_base_amount numeric,
  p_card_brand text
)
returns void
language plpgsql
stable
security definer
set search_path = public, vault, extensions
as $$
declare
  v_card_brand text := upper(trim(coalesce(p_card_brand, '')));
  v_signed_total numeric;
  v_expected_total numeric;
begin
  perform public.payment_verify_installment_selection_hmac(p_submitted_hmac, p_payload);

  if (p_payload->>'proposal_id')::uuid is distinct from p_proposal_id then
    raise exception 'INSTALLMENT_HMAC_PROPOSAL_MISMATCH'
      using errcode = '22023';
  end if;

  if (p_payload->>'service_id')::uuid is distinct from p_service_id then
    raise exception 'INSTALLMENT_HMAC_SERVICE_MISMATCH'
      using errcode = '22023';
  end if;

  if round((p_payload->>'base_amount')::numeric, 2) <> round(p_base_amount, 2) then
    raise exception 'INSTALLMENT_HMAC_BASE_AMOUNT_MISMATCH'
      using errcode = '22023';
  end if;

  if upper(trim(coalesce(p_payload->>'card_brand', ''))) <> v_card_brand then
    raise exception 'INSTALLMENT_HMAC_BRAND_MISMATCH'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(p_payload->'installment_options') opt
    where (opt->>'installment_number')::smallint = p_installment_number
  ) then
    raise exception 'INSTALLMENT_HMAC_INSTALLMENT_MISMATCH'
      using errcode = '22023';
  end if;

  select (opt->>'total_with_fees')::numeric
  into v_signed_total
  from jsonb_array_elements(p_payload->'installment_options') opt
  where (opt->>'installment_number')::smallint = p_installment_number;

  v_expected_total := public.payment_total_with_card_fees(
    p_base_amount,
    v_card_brand,
    p_installment_number
  );

  if round(coalesce(v_signed_total, 0), 2) <> round(v_expected_total, 2) then
    raise exception 'INSTALLMENT_HMAC_FEE_AMOUNT_MISMATCH'
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.payment_assert_installment_hmac_context(
  text, jsonb, uuid, uuid, smallint, numeric, text
) is
  'Verifies installment HMAC signature and binds proposal, service, amount, brand, and installment number.';

revoke all on function public.payment_verify_installment_selection_hmac(text, jsonb) from public;
revoke all on function public.payment_verify_installment_selection_hmac(text, jsonb) from anon;
revoke all on function public.payment_verify_installment_selection_hmac(text, jsonb) from authenticated;

revoke all on function public.payment_assert_installment_hmac_context(
  text, jsonb, uuid, uuid, smallint, numeric, text
) from public;
revoke all on function public.payment_assert_installment_hmac_context(
  text, jsonb, uuid, uuid, smallint, numeric, text
) from anon;
revoke all on function public.payment_assert_installment_hmac_context(
  text, jsonb, uuid, uuid, smallint, numeric, text
) from authenticated;

create or replace function public.payment_update_method(
  p_service_id uuid,
  p_new_client_card_token_id uuid,
  p_installment_selection_hmac text default null,
  p_installment_hmac_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_new_token public.client_card_tokens%rowtype;
  v_old_brand text;
  v_new_brand text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for payment_update_method'
      using errcode = '42501';
  end if;

  if p_service_id is null or p_new_client_card_token_id is null then
    raise exception 'p_service_id and p_new_client_card_token_id are required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  join public.contracted_services cs on cs.id = ps.contracted_service_id
  where ps.contracted_service_id = p_service_id
    and ps.client_id = auth.uid()
    and cs.client_id = auth.uid()
    and ps.state in ('SCHEDULED', 'FAILED')
  for update of ps;

  if not found then
    raise exception 'INVALID_SCHEDULE_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'INVALID_SCHEDULE_STATE')::text;
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id;

  select *
  into v_new_token
  from public.client_card_tokens cct
  where cct.id = p_new_client_card_token_id
    and cct.client_id = auth.uid()
    and cct.state = 'ACTIVE';

  if not found then
    raise exception 'PAYMENT_TOKEN_INACTIVE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_TOKEN_INACTIVE')::text;
  end if;

  v_new_brand := upper(trim(v_new_token.card_brand));

  if v_schedule.client_card_token_id is not null then
    select upper(trim(cct.card_brand))
    into v_old_brand
    from public.client_card_tokens cct
    where cct.id = v_schedule.client_card_token_id;
  end if;

  if coalesce(v_old_brand, '') <> v_new_brand then
    perform public.payment_assert_installment_hmac_context(
      p_installment_selection_hmac,
      p_installment_hmac_payload,
      v_service.accepted_proposal_id,
      v_service.service_request_id,
      v_schedule.installment_number,
      v_schedule.base_amount,
      v_new_brand
    );
  end if;

  update public.payment_schedules ps
  set
    client_card_token_id = p_new_client_card_token_id,
    needs_payment_method_update = false,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'PAYMENT_METHOD_UPDATED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_actor := 'client',
    p_actor_id := auth.uid(),
    p_metadata := jsonb_build_object(
      'old_client_card_token_id', v_schedule.client_card_token_id,
      'new_client_card_token_id', p_new_client_card_token_id,
      'old_brand', v_old_brand,
      'new_brand', v_new_brand
    )
  );

  return jsonb_build_object(
    'schedule_id', v_schedule.id,
    'client_card_token_id', p_new_client_card_token_id
  );
end;
$$;

comment on function public.payment_update_method(uuid, uuid, text, jsonb) is
  'Updates client_card_token_id on eligible schedules; revalidates installment HMAC when card brand changes.';

revoke all on function public.payment_update_method(uuid, uuid, text, jsonb) from public;
revoke all on function public.payment_update_method(uuid, uuid, text, jsonb) from anon;
revoke all on function public.payment_update_method(uuid, uuid, text, jsonb) from service_role;

grant execute on function public.payment_update_method(uuid, uuid, text, jsonb) to authenticated;
