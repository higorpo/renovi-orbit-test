-- Payment Task 42: payment_activate_provider_from_netcred RPC (design.md §4.1.2, Req 4).

create or replace function public.payment_activate_provider_from_netcred(
  p_provider_gateway_account_id uuid,
  p_netcred_company_id text,
  p_netcred_bank_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_account public.provider_gateway_accounts%rowtype;
  v_mmd jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_activate_provider_from_netcred'
      using errcode = '42501';
  end if;

  if p_provider_gateway_account_id is null then
    raise exception 'p_provider_gateway_account_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_netcred_company_id), '') is null
    or nullif(btrim(p_netcred_bank_account_id), '') is null then
    raise exception 'NETCRED_IDS_REQUIRED'
      using errcode = '22023';
  end if;

  select pga.*
  into v_account
  from public.provider_gateway_accounts pga
  where pga.id = p_provider_gateway_account_id
  for update;

  if not found then
    raise exception 'PROVIDER_GATEWAY_ACCOUNT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_account.onboarding_status not in (
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  update public.provider_gateway_accounts pga
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    netcred_company_id = btrim(p_netcred_company_id),
    netcred_bank_account_id = btrim(p_netcred_bank_account_id),
    onboarding_activated_at = now(),
    updated_at = now()
  where pga.id = p_provider_gateway_account_id;

  perform public.payment_write_audit(
    p_event_type := 'PROVIDER_ACTIVATED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := p_provider_gateway_account_id,
    p_from_state := v_account.onboarding_status::text,
    p_to_state := 'ACTIVE',
    p_actor := 'cron'::public.payment_audit_actor,
    p_actor_id := v_account.provider_id,
    p_metadata := jsonb_build_object(
      'netcred_company_id', btrim(p_netcred_company_id),
      'netcred_bank_account_id', btrim(p_netcred_bank_account_id),
      'gateway_slug', v_account.gateway_slug
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ProviderCredentialed',
    p_aggregate_type := 'provider_gateway_account',
    p_aggregate_id := p_provider_gateway_account_id,
    p_payload := jsonb_build_object(
      'provider_id', v_account.provider_id,
      'netcred_company_id', btrim(p_netcred_company_id),
      'netcred_bank_account_id', btrim(p_netcred_bank_account_id)
    )
  );

  v_mmd := public.mmd_ingest_event(
    'PROVIDER_ACTIVATED',
    v_account.provider_id,
    format('provider-activated:%s', p_provider_gateway_account_id),
    jsonb_build_object(
      'provider_gateway_account_id', p_provider_gateway_account_id,
      'provider_id', v_account.provider_id
    ),
    jsonb_build_object(
      'source', 'payment_activate_provider_from_netcred',
      'gateway_slug', v_account.gateway_slug
    )
  );

  return jsonb_build_object(
    'provider_gateway_account_id', p_provider_gateway_account_id,
    'provider_id', v_account.provider_id,
    'onboarding_status', 'ACTIVE',
    'netcred_company_id', btrim(p_netcred_company_id),
    'netcred_bank_account_id', btrim(p_netcred_bank_account_id),
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_activate_provider_from_netcred(uuid, text, text) is
  'Atomically activates provider gateway account from NetCred onboarding detection (service_role only).';

revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from public;
revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from anon;
revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from authenticated;

grant execute on function public.payment_activate_provider_from_netcred(uuid, text, text) to service_role;
