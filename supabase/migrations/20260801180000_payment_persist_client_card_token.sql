-- Payment Task 20: payment_persist_client_card_token RPC (design.md §4.2.3).

create or replace function public.payment_persist_client_card_token(
  p_client_id uuid,
  p_gateway_payment_profile_id text,
  p_card_number_masked text,
  p_card_brand text,
  p_gateway_card_token text,
  p_expiry_month smallint,
  p_expiry_year smallint,
  p_cardholder_name text,
  p_billing_address jsonb,
  p_netcred_company_id text,
  p_gateway_slug public.payment_gateway_slug default 'netcred'::public.payment_gateway_slug
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
  v_company_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_persist_client_card_token'
      using errcode = '42501';
  end if;

  if p_client_id is null then
    raise exception 'p_client_id is required'
      using errcode = '22023';
  end if;

  if p_gateway_payment_profile_id is null or trim(p_gateway_payment_profile_id) = '' then
    raise exception 'p_gateway_payment_profile_id is required'
      using errcode = '22023';
  end if;

  if p_netcred_company_id is null or trim(p_netcred_company_id) = '' then
    raise exception 'p_netcred_company_id is required'
      using errcode = '22023';
  end if;

  v_company_id := trim(p_netcred_company_id);

  if p_card_brand is null or trim(p_card_brand) = '' then
    raise exception 'p_card_brand is required'
      using errcode = '22023';
  end if;

  if p_gateway_card_token is null or trim(p_gateway_card_token) = '' then
    raise exception 'p_gateway_card_token is required'
      using errcode = '22023';
  end if;

  if p_billing_address is null or jsonb_typeof(p_billing_address) <> 'object' then
    raise exception 'p_billing_address must be a JSON object'
      using errcode = '22023';
  end if;

  if public.payment_client_card_token_is_expired(p_expiry_month, p_expiry_year) then
    raise exception 'CLIENT_CARD_TOKEN_EXPIRED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CLIENT_CARD_TOKEN_EXPIRED')::text;
  end if;

  insert into public.client_card_tokens (
    client_id,
    gateway_slug,
    gateway_payment_profile_id,
    netcred_company_id,
    card_number_masked,
    card_brand,
    gateway_card_token,
    expiry_month,
    expiry_year,
    cardholder_name,
    billing_address,
    state
  )
  values (
    p_client_id,
    p_gateway_slug,
    trim(p_gateway_payment_profile_id),
    v_company_id,
    coalesce(p_card_number_masked, ''),
    upper(trim(p_card_brand)),
    trim(p_gateway_card_token),
    p_expiry_month,
    p_expiry_year,
    trim(p_cardholder_name),
    p_billing_address,
    'ACTIVE'::public.payment_client_card_token_state
  )
  on conflict on constraint client_card_tokens_client_profile_unique
  do update set
    netcred_company_id = excluded.netcred_company_id,
    card_number_masked = excluded.card_number_masked,
    card_brand = excluded.card_brand,
    gateway_card_token = excluded.gateway_card_token,
    expiry_month = excluded.expiry_month,
    expiry_year = excluded.expiry_year,
    cardholder_name = excluded.cardholder_name,
    billing_address = excluded.billing_address,
    state = 'ACTIVE'::public.payment_client_card_token_state,
    updated_at = now()
  returning id into v_token_id;

  perform public.payment_write_audit(
    p_event_type := 'CARD_TOKEN_PERSISTED',
    p_entity_type := 'client_card_token',
    p_entity_id := v_token_id,
    p_to_state := 'ACTIVE',
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'client_id', p_client_id,
      'card_brand', upper(trim(p_card_brand)),
      'gateway_payment_profile_id', trim(p_gateway_payment_profile_id)
    )
  );

  return jsonb_build_object(
    'client_card_token_id', v_token_id,
    'card_number_masked', coalesce(p_card_number_masked, ''),
    'card_brand', upper(trim(p_card_brand)),
    'state', 'ACTIVE'
  );
end;
$$;

comment on function public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, text, public.payment_gateway_slug
) is
  'Inserts or reactivates client_card_tokens after NetCred tokenization (service_role only). Binds netcred_company_id for charge/accept match.';

revoke all on function public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, text, public.payment_gateway_slug
) from public;
revoke all on function public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, text, public.payment_gateway_slug
) from anon;
revoke all on function public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, text, public.payment_gateway_slug
) from authenticated;

grant execute on function public.payment_persist_client_card_token(
  uuid, text, text, text, text, smallint, smallint, text, jsonb, text, public.payment_gateway_slug
) to service_role;
