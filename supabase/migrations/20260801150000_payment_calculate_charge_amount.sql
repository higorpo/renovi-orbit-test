-- Payment Task 17: card fee helpers + payment_calculate_charge_amount RPC (design.md §4.3.1, §5.2).

create or replace function public.payment_round_half_even(
  p_value numeric,
  p_scale integer default 2
)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_factor numeric := power(10::numeric, p_scale);
  v_scaled numeric;
  v_floor bigint;
  v_frac numeric;
begin
  v_scaled := p_value * v_factor;
  v_floor := trunc(v_scaled)::bigint;
  v_frac := v_scaled - v_floor;

  if v_frac > 0.5 then
    return (v_floor + 1) / v_factor;
  elsif v_frac < 0.5 then
    return v_floor / v_factor;
  elsif mod(v_floor, 2) = 0 then
    return v_floor / v_factor;
  else
    return (v_floor + 1) / v_factor;
  end if;
end;
$$;

comment on function public.payment_round_half_even(numeric, integer) is
  'Banker''s rounding (ROUND_HALF_EVEN) for monetary amounts per design.md §4.3.1.';

revoke all on function public.payment_round_half_even(numeric, integer) from public;
revoke all on function public.payment_round_half_even(numeric, integer) from anon;
revoke all on function public.payment_round_half_even(numeric, integer) from authenticated;

create or replace function public.payment_cc_fee_rate_key(
  p_card_brand text,
  p_installment_number smallint
)
returns text
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_card_brand text := upper(trim(coalesce(p_card_brand, '')));
begin
  if p_installment_number is null
    or p_installment_number < 1
    or p_installment_number > 12 then
    raise exception 'p_installment_number must be between 1 and 12'
      using errcode = '22023';
  end if;

  if v_card_brand in ('VCC', 'MASTER') then
    if p_installment_number = 1 then
      return 'cc_visa_master_1x_rate';
    elsif p_installment_number between 2 and 6 then
      return 'cc_visa_master_2_6x_rate';
    else
      return 'cc_visa_master_7_12x_rate';
    end if;
  end if;

  if p_installment_number = 1 then
    return 'cc_elo_other_1x_rate';
  elsif p_installment_number between 2 and 6 then
    return 'cc_elo_other_2_6x_rate';
  else
    return 'cc_elo_other_7_12x_rate';
  end if;
end;
$$;

comment on function public.payment_cc_fee_rate_key(text, smallint) is
  'Maps card brand + installment count to platform_constants fee rate key (design.md §4.3.1).';

create or replace function public.payment_total_with_card_fees(
  p_base_amount numeric,
  p_card_brand text,
  p_installment_number smallint
)
returns numeric
language plpgsql
stable
parallel safe
set search_path = public
as $$
declare
  v_rate_pct numeric;
  v_fixed_fee numeric;
begin
  if p_base_amount is null or p_base_amount <= 0 then
    raise exception 'p_base_amount must be positive'
      using errcode = '22023';
  end if;

  v_rate_pct := public.platform_constant_numeric(
    public.payment_cc_fee_rate_key(p_card_brand, p_installment_number),
    0
  );
  v_fixed_fee := public.platform_constant_numeric('cc_fixed_processing_fee_brl', 0);

  return public.payment_round_half_even(
    (p_base_amount * (1 + v_rate_pct / 100)) + v_fixed_fee,
    2
  );
end;
$$;

comment on function public.payment_total_with_card_fees(numeric, text, smallint) is
  'Total charge amount (base + card fees) shared by installment options and charge RPCs.';

revoke all on function public.payment_cc_fee_rate_key(text, smallint) from public;
revoke all on function public.payment_cc_fee_rate_key(text, smallint) from anon;

revoke all on function public.payment_total_with_card_fees(numeric, text, smallint) from public;
revoke all on function public.payment_total_with_card_fees(numeric, text, smallint) from anon;

grant execute on function public.payment_cc_fee_rate_key(text, smallint) to service_role;
grant execute on function public.payment_cc_fee_rate_key(text, smallint) to authenticated;

grant execute on function public.payment_total_with_card_fees(numeric, text, smallint) to service_role;
grant execute on function public.payment_total_with_card_fees(numeric, text, smallint) to authenticated;

create or replace function public.payment_calculate_charge_amount(
  p_client_card_token_id uuid,
  p_base_amount numeric,
  p_installment_number smallint
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_card_brand text;
begin
  if p_client_card_token_id is null then
    raise exception 'p_client_card_token_id is required'
      using errcode = '22023';
  end if;

  if p_base_amount is null or p_base_amount <= 0 then
    raise exception 'p_base_amount must be positive'
      using errcode = '22023';
  end if;

  if p_installment_number is null
    or p_installment_number < 1
    or p_installment_number > 12 then
    raise exception 'p_installment_number must be between 1 and 12'
      using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication required for payment_calculate_charge_amount'
        using errcode = '42501';
    end if;
  end if;

  select cct.card_brand
  into v_card_brand
  from public.client_card_tokens cct
  where cct.id = p_client_card_token_id
    and (
      coalesce(auth.role(), '') = 'service_role'
      or cct.client_id = auth.uid()
    );

  if v_card_brand is null then
    raise exception 'CLIENT_CARD_TOKEN_NOT_FOUND'
      using
        errcode = 'P0002',
        detail = jsonb_build_object('code', 'CLIENT_CARD_TOKEN_NOT_FOUND')::text;
  end if;

  return public.payment_total_with_card_fees(
    p_base_amount,
    v_card_brand,
    p_installment_number
  );
end;
$$;

comment on function public.payment_calculate_charge_amount(uuid, numeric, smallint) is
  'Computes total charge amount from base_amount, card brand fee tier, and platform_constants (ROUND_HALF_EVEN).';

revoke all on function public.payment_calculate_charge_amount(uuid, numeric, smallint) from public;
revoke all on function public.payment_calculate_charge_amount(uuid, numeric, smallint) from anon;

grant execute on function public.payment_calculate_charge_amount(uuid, numeric, smallint) to service_role;
grant execute on function public.payment_calculate_charge_amount(uuid, numeric, smallint) to authenticated;
