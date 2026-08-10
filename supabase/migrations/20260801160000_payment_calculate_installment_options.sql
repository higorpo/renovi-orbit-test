-- Payment Task 18: payment_calculate_installment_options RPC (design.md §4.3.1–4.3.2).

create or replace function public.payment_installment_hmac_canonical_text(p_payload jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select concat_ws(
    '|',
    p_payload->>'proposal_id',
    p_payload->>'service_id',
    to_char((p_payload->>'base_amount')::numeric, 'FM999999990.00'),
    upper(trim(coalesce(p_payload->>'card_brand', ''))),
    p_payload->>'expires_at',
    coalesce(
      (
        select string_agg(
          concat_ws(
            ':',
            opt->>'installment_number',
            to_char((opt->>'applicable_rate_pct')::numeric, 'FM999999990.00'),
            to_char((opt->>'total_with_fees')::numeric, 'FM999999990.00'),
            to_char((opt->>'installment_amount')::numeric, 'FM999999990.00')
          ),
          ';' order by (opt->>'installment_number')::int
        )
        from jsonb_array_elements(p_payload->'installment_options') opt
      ),
      ''
    )
  );
$$;

comment on function public.payment_installment_hmac_canonical_text(jsonb) is
  'Deterministic scalar serialization for installment HMAC signing and verification.';

create or replace function public.payment_calculate_installment_options(
  p_proposal_id uuid,
  p_service_id uuid,
  p_card_brand text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, vault, extensions
as $$
declare
  v_card_brand text;
  v_base_amount numeric;
  v_rate_pct numeric;
  v_total_with_fees numeric;
  v_installment_amount numeric;
  v_min_installment_value numeric;
  v_options jsonb := '[]'::jsonb;
  v_n smallint;
  v_computed_at timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_ttl_minutes numeric;
  v_secret text;
  v_hmac_payload jsonb;
  v_hmac_hex text;
begin
  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  if p_service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  if p_card_brand is null or trim(p_card_brand) = '' then
    raise exception 'p_card_brand is required'
      using errcode = '22023';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required for payment_calculate_installment_options'
      using errcode = '42501';
  end if;

  v_card_brand := upper(trim(p_card_brand));

  select round(pp.proposed_amount::numeric, 2)
  into v_base_amount
  from public.provider_proposals pp
  join public.service_requests sr on sr.id = pp.service_request_id
  where pp.id = p_proposal_id
    and pp.service_request_id = p_service_id
    and sr.client_id = auth.uid();

  if v_base_amount is null or v_base_amount <= 0 then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0002',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  v_ttl_minutes := public.platform_constant_numeric('installment_hmac_expires_minutes', 10);
  v_expires_at := v_computed_at + make_interval(mins => v_ttl_minutes::integer);
  v_min_installment_value := public.platform_constant_numeric('min_installment_value', 150);

  for v_n in 1..12 loop
    v_rate_pct := public.platform_constant_numeric(
      public.payment_cc_fee_rate_key(v_card_brand, v_n::smallint),
      0
    );
    v_total_with_fees := public.payment_total_with_card_fees(
      v_base_amount,
      v_card_brand,
      v_n::smallint
    );
    v_installment_amount := public.payment_round_half_even(
      v_total_with_fees / v_n::numeric,
      2
    );

    -- 1x is always offered; n > 1 requires installment_amount >= min_installment_value.
    if v_n > 1 and v_installment_amount < v_min_installment_value then
      continue;
    end if;

    v_options := v_options || jsonb_build_array(
      jsonb_build_object(
        'installment_number', v_n,
        'applicable_rate_pct', v_rate_pct,
        'total_with_fees', v_total_with_fees,
        'installment_amount', v_installment_amount
      )
    );
  end loop;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'installment_signing_secret';

  if v_secret is null or trim(v_secret) = '' then
    raise exception 'Installment signing secret is not configured in vault';
  end if;

  v_hmac_payload := jsonb_build_object(
    'proposal_id', p_proposal_id,
    'service_id', p_service_id,
    'base_amount', v_base_amount,
    'card_brand', v_card_brand,
    'installment_options', v_options,
    'computed_at', to_jsonb(v_computed_at),
    'expires_at', to_jsonb(v_expires_at)
  );

  v_hmac_hex := encode(
    extensions.hmac(
      public.payment_installment_hmac_canonical_text(v_hmac_payload),
      v_secret::text,
      'sha256'::text
    ),
    'hex'
  );

  return jsonb_build_object(
    'installment_options', v_options,
    'installment_selection_hmac', v_hmac_hex,
    'installment_hmac_payload', v_hmac_payload,
    'expires_at', to_jsonb(v_expires_at),
    'computed_at', to_jsonb(v_computed_at)
  );
end;
$$;

comment on function public.payment_calculate_installment_options(uuid, uuid, text) is
  'Client checkout RPC: fee table 1–12 (n>1 only when installment_amount >= min_installment_value) with HMAC-signed payload (Vault installment_signing_secret).';

revoke all on function public.payment_installment_hmac_canonical_text(jsonb) from public;
revoke all on function public.payment_installment_hmac_canonical_text(jsonb) from anon;
revoke all on function public.payment_installment_hmac_canonical_text(jsonb) from authenticated;

revoke all on function public.payment_calculate_installment_options(uuid, uuid, text) from public;
revoke all on function public.payment_calculate_installment_options(uuid, uuid, text) from anon;
revoke all on function public.payment_calculate_installment_options(uuid, uuid, text) from service_role;

grant execute on function public.payment_calculate_installment_options(uuid, uuid, text) to authenticated;
