-- Harden provider proposal pricing flow against payload tampering.
-- This migration centralizes pricing signature generation/validation and
-- updates RPCs so proposal creation is verified server-side.

insert into public.platform_constants (key, value)
values ('pricing_signature_secret', to_jsonb('renovi-provider-pricing-secret-v1'::text))
on conflict (key) do update set value = excluded.value;

create or replace function public.generate_provider_pricing_signature(
  p_original_amount numeric,
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret jsonb;
begin
  select value
  into v_secret
  from public.platform_constants
  where key = 'pricing_signature_secret';

  if v_secret is null or jsonb_typeof(v_secret) <> 'string' then
    raise exception 'Pricing signature secret is not configured';
  end if;

  return encode(
    extensions.hmac(
      concat_ws(
        '|',
        round(p_original_amount::numeric, 2)::text,
        round(p_tax_rate::numeric, 4)::text,
        round(p_tax_amount::numeric, 2)::text,
        round(p_final_amount::numeric, 2)::text
      )::text,
      trim(both '"' from v_secret::text)::text,
      'sha256'::text
    ),
    'hex'
  );
end;
$$;

create or replace function public.calculate_provider_service_pricing(
  p_original_amount numeric,
  p_tax_key text default 'renovi_tax_provider'
)
returns table (
  original_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  final_amount numeric,
  pricing_signature text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_tax_value jsonb;
  v_tax_rate numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_user_role
  from public.profiles p
  where p.id = v_user_id;

  if v_user_role not in ('provider', 'admin') then
    raise exception 'Only providers and admins can calculate provider pricing';
  end if;

  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Original amount must be greater than zero';
  end if;

  select pc.value
  into v_tax_value
  from public.platform_constants pc
  where pc.key = p_tax_key;

  if v_tax_value is null then
    raise exception 'Platform constant not found for key: %', p_tax_key;
  end if;

  if jsonb_typeof(v_tax_value) <> 'number' then
    raise exception 'Tax constant must be a numeric JSON value for key: %', p_tax_key;
  end if;

  v_tax_rate := (v_tax_value)::text::numeric;

  if v_tax_rate < 0 or v_tax_rate > 1 then
    raise exception 'Tax rate must be between 0 and 1';
  end if;

  original_amount := round(p_original_amount::numeric, 2);
  tax_rate := v_tax_rate;
  tax_amount := round((p_original_amount * v_tax_rate)::numeric, 2);
  final_amount := round((p_original_amount - (p_original_amount * v_tax_rate))::numeric, 2);
  pricing_signature := public.generate_provider_pricing_signature(
    original_amount,
    tax_rate,
    tax_amount,
    final_amount
  );

  return next;
end;
$$;

comment on function public.calculate_provider_service_pricing(numeric, text) is 'Calculates provider pricing using a dynamic tax constant key and returns a tamper-proof pricing signature.';
revoke execute on function public.calculate_provider_service_pricing(numeric, text) from anon;
grant execute on function public.calculate_provider_service_pricing(numeric, text) to authenticated;

create or replace function public.validate_provider_proposal_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pricing record;
  v_expected_signature text;
begin
  select *
  into v_pricing
  from public.calculate_provider_service_pricing(new.proposed_amount);

  if v_pricing is null then
    raise exception 'Unable to validate proposal pricing';
  end if;

  if round(new.tax_rate::numeric, 4) <> round(v_pricing.tax_rate::numeric, 4)
    or round(new.tax_amount::numeric, 2) <> round(v_pricing.tax_amount::numeric, 2)
    or round(new.final_amount::numeric, 2) <> round(v_pricing.final_amount::numeric, 2) then
    raise exception 'Proposal pricing fields do not match server calculation';
  end if;

  v_expected_signature := public.generate_provider_pricing_signature(
    new.proposed_amount,
    new.tax_rate,
    new.tax_amount,
    new.final_amount
  );

  if new.pricing_signature <> v_expected_signature then
    raise exception 'Invalid proposal pricing signature';
  end if;

  return new;
end;
$$;

drop trigger if exists provider_proposals_validate_pricing on public.provider_proposals;
create trigger provider_proposals_validate_pricing
  before insert or update of proposed_amount, tax_rate, tax_amount, final_amount, pricing_signature
  on public.provider_proposals
  for each row execute function public.validate_provider_proposal_pricing();

create or replace function public.create_provider_proposal(
  p_service_request_id uuid,
  p_proposed_amount numeric,
  p_proposal_description text,
  p_photos text[],
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_final_amount numeric,
  p_pricing_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_proposal_id uuid;
begin
  v_provider_id := auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can create proposals';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  if p_proposed_amount is null or p_proposed_amount <= 0 then
    raise exception 'Proposed amount must be greater than zero';
  end if;

  if nullif(trim(p_proposal_description), '') is null then
    raise exception 'Proposal description is required';
  end if;

  if exists (
    select 1
    from public.provider_proposals pp
    where pp.provider_id = v_provider_id
      and pp.service_request_id = p_service_request_id
      and pp.status <> 'withdrawn'
  ) then
    raise exception 'Provider already submitted a proposal for this service request';
  end if;

  insert into public.provider_proposals (
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status
  ) values (
    v_provider_id,
    p_service_request_id,
    round(p_proposed_amount::numeric, 2),
    trim(p_proposal_description),
    coalesce(p_photos, '{}'::text[]),
    round(p_tax_rate::numeric, 4),
    round(p_tax_amount::numeric, 2),
    round(p_final_amount::numeric, 2),
    p_pricing_signature,
    'submitted'
  )
  returning id into v_proposal_id;

  return jsonb_build_object('id', v_proposal_id);
end;
$$;

revoke execute on function public.create_provider_proposal(uuid, numeric, text, text[], numeric, numeric, numeric, text) from anon;
grant execute on function public.create_provider_proposal(uuid, numeric, text, text[], numeric, numeric, numeric, text) to authenticated;
