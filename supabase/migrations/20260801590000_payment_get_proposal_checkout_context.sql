-- Payment: client checkout context for accept_proposal (pricing_signature + payment_required).

create or replace function public.payment_get_proposal_checkout_context(p_proposal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_pp public.provider_proposals%rowtype;
  v_payment_required boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required for payment_get_proposal_checkout_context'
      using errcode = '42501';
  end if;

  if p_proposal_id is null then
    raise exception 'p_proposal_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_pp
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = v_pp.service_request_id
      and sr.client_id = v_actor
  ) then
    raise exception 'PROPOSAL_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PROPOSAL_NOT_FOUND')::text;
  end if;

  v_payment_required := public.payment_provider_is_credentialed(
    v_pp.provider_id,
    'netcred'::public.payment_gateway_slug
  );

  return jsonb_build_object(
    'proposal_id', v_pp.id,
    'service_request_id', v_pp.service_request_id,
    'provider_id', v_pp.provider_id,
    'proposed_amount', v_pp.proposed_amount,
    'pricing_signature', v_pp.pricing_signature,
    'payment_required', v_payment_required
  );
end;
$$;

comment on function public.payment_get_proposal_checkout_context(uuid) is
  'Client checkout: pricing_signature (Vault-validated at accept) and whether provider requires payment.';

revoke all on function public.payment_get_proposal_checkout_context(uuid) from public;
revoke all on function public.payment_get_proposal_checkout_context(uuid) from anon;
revoke all on function public.payment_get_proposal_checkout_context(uuid) from service_role;

grant execute on function public.payment_get_proposal_checkout_context(uuid) to authenticated;
