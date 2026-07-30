-- Payment Task 43: payment_update_provider_onboarding_status RPC (design.md §4.1.2, Req 4).
-- Also payment_reject_provider_onboarding for ops rejection + MMD.

create or replace function public.payment_update_provider_onboarding_status(
  p_provider_gateway_account_id uuid,
  p_onboarding_status public.payment_provider_onboarding_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_account public.provider_gateway_accounts%rowtype;
  v_updated boolean := false;
  v_mmd jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_update_provider_onboarding_status'
      using errcode = '42501';
  end if;

  if p_provider_gateway_account_id is null or p_onboarding_status is null then
    raise exception 'p_provider_gateway_account_id and p_onboarding_status are required'
      using errcode = '22023';
  end if;

  if p_onboarding_status not in (
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) then
    raise exception 'UNSUPPORTED_ONBOARDING_STATUS'
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

  if v_account.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status then
    return jsonb_build_object(
      'provider_gateway_account_id', p_provider_gateway_account_id,
      'provider_id', v_account.provider_id,
      'onboarding_status', v_account.onboarding_status,
      'updated', false,
      'noop', true,
      'reason', 'already_active'
    );
  end if;

  if v_account.onboarding_status = p_onboarding_status then
    return jsonb_build_object(
      'provider_gateway_account_id', p_provider_gateway_account_id,
      'provider_id', v_account.provider_id,
      'onboarding_status', v_account.onboarding_status,
      'updated', false,
      'noop', true,
      'reason', 'already_in_target_state'
    );
  end if;

  if v_account.onboarding_status <> 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  update public.provider_gateway_accounts pga
  set
    onboarding_status = p_onboarding_status,
    updated_at = now()
  where pga.id = p_provider_gateway_account_id;

  perform public.payment_write_audit(
    p_event_type := 'PROVIDER_ONBOARDING_STATUS_UPDATED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := p_provider_gateway_account_id,
    p_from_state := v_account.onboarding_status::text,
    p_to_state := p_onboarding_status::text,
    p_actor := 'cron'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'provider_id', v_account.provider_id,
      'gateway_slug', v_account.gateway_slug
    )
  );

  v_updated := true;

  begin
    v_mmd := public.mmd_ingest_event(
      'PROVIDER_ONBOARDING_UNDER_REVIEW',
      v_account.provider_id,
      format('provider-kyc-under-review:%s', p_provider_gateway_account_id),
      jsonb_build_object(
        'provider_id', v_account.provider_id,
        'provider_gateway_account_id', p_provider_gateway_account_id,
        'deep_link_path', '/dashboard'
      ),
      jsonb_build_object(
        'source', 'payment_update_provider_onboarding_status',
        'recipient', 'provider'
      )
    );
  exception
    when others then
      raise log 'payment_update_provider_onboarding_status mmd_ingest_failed account_id=% sqlstate=% message=%',
        p_provider_gateway_account_id,
        sqlstate,
        sqlerrm;
      v_mmd := jsonb_build_object('skipped', true, 'reason', sqlerrm);
  end;

  return jsonb_build_object(
    'provider_gateway_account_id', p_provider_gateway_account_id,
    'provider_id', v_account.provider_id,
    'onboarding_status', p_onboarding_status,
    'from_state', v_account.onboarding_status,
    'updated', v_updated,
    'noop', false,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_update_provider_onboarding_status(uuid, public.payment_provider_onboarding_status) is
  'Sets intermediate provider onboarding status without persisting NetCred ids (service_role only). Emits PROVIDER_ONBOARDING_UNDER_REVIEW MMD best-effort.';

revoke all on function public.payment_update_provider_onboarding_status(uuid, public.payment_provider_onboarding_status)
  from public;
revoke all on function public.payment_update_provider_onboarding_status(uuid, public.payment_provider_onboarding_status)
  from anon;
revoke all on function public.payment_update_provider_onboarding_status(uuid, public.payment_provider_onboarding_status)
  from authenticated;

grant execute on function public.payment_update_provider_onboarding_status(uuid, public.payment_provider_onboarding_status)
  to service_role;

create or replace function public.payment_reject_provider_onboarding(
  p_provider_gateway_account_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_account public.provider_gateway_accounts%rowtype;
  v_reason text;
  v_mmd jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_reject_provider_onboarding'
      using errcode = '42501';
  end if;

  if p_provider_gateway_account_id is null then
    raise exception 'p_provider_gateway_account_id is required'
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

  if v_account.onboarding_status = 'REJECTED'::public.payment_provider_onboarding_status then
    return jsonb_build_object(
      'provider_gateway_account_id', p_provider_gateway_account_id,
      'provider_id', v_account.provider_id,
      'onboarding_status', v_account.onboarding_status,
      'updated', false,
      'noop', true,
      'reason', 'already_rejected'
    );
  end if;

  if v_account.onboarding_status not in (
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'ADMIN_REJECTION');

  update public.provider_gateway_accounts pga
  set
    onboarding_status = 'REJECTED'::public.payment_provider_onboarding_status,
    updated_at = now()
  where pga.id = p_provider_gateway_account_id;

  perform public.payment_write_audit(
    p_event_type := 'PROVIDER_KYC_REJECTED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := p_provider_gateway_account_id,
    p_from_state := v_account.onboarding_status::text,
    p_to_state := 'REJECTED',
    p_actor := 'system'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'provider_id', v_account.provider_id,
      'gateway_slug', v_account.gateway_slug,
      'reason', v_reason
    )
  );

  begin
    v_mmd := public.mmd_ingest_event(
      'PROVIDER_KYC_REJECTED',
      v_account.provider_id,
      format('provider-kyc-rejected:%s', p_provider_gateway_account_id),
      jsonb_build_object(
        'provider_id', v_account.provider_id,
        'provider_gateway_account_id', p_provider_gateway_account_id,
        'reason', v_reason,
        'deep_link_path', '/dashboard'
      ),
      jsonb_build_object(
        'source', 'payment_reject_provider_onboarding',
        'recipient', 'provider'
      )
    );
  exception
    when others then
      raise log 'payment_reject_provider_onboarding mmd_ingest_failed account_id=% sqlstate=% message=%',
        p_provider_gateway_account_id,
        sqlstate,
        sqlerrm;
      v_mmd := jsonb_build_object('skipped', true, 'reason', sqlerrm);
  end;

  return jsonb_build_object(
    'provider_gateway_account_id', p_provider_gateway_account_id,
    'provider_id', v_account.provider_id,
    'onboarding_status', 'REJECTED',
    'from_state', v_account.onboarding_status,
    'updated', true,
    'noop', false,
    'reason', v_reason,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_reject_provider_onboarding(uuid, text) is
  'Ops/admin: transitions DOCUMENTS_SUBMITTED|UNDER_NETCRED_REVIEW → REJECTED with audit + PROVIDER_KYC_REJECTED MMD (service_role only).';

revoke all on function public.payment_reject_provider_onboarding(uuid, text) from public;
revoke all on function public.payment_reject_provider_onboarding(uuid, text) from anon;
revoke all on function public.payment_reject_provider_onboarding(uuid, text) from authenticated;

grant execute on function public.payment_reject_provider_onboarding(uuid, text) to service_role;
