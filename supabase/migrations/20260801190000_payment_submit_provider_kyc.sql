-- Payment Task 21: payment_submit_provider_kyc RPC (design.md §4.1.1).
-- Persists KYC in TX; credenciamento email is dispatched post-commit by dispatch-kyc-email EF.

create or replace function public.payment_mark_kyc_credenciamento_email_dispatched(
  p_provider_gateway_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_mark_kyc_credenciamento_email_dispatched'
      using errcode = '42501';
  end if;

  if p_provider_gateway_account_id is null then
    raise exception 'p_provider_gateway_account_id is required'
      using errcode = '22023';
  end if;

  update public.provider_gateway_accounts pga
  set
    email_dispatched_at = now(),
    updated_at = now()
  where pga.id = p_provider_gateway_account_id
    and pga.onboarding_status = 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status;

  if not found then
    raise exception 'PROVIDER_GATEWAY_ACCOUNT_NOT_FOUND'
      using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.payment_mark_kyc_credenciamento_email_dispatched(uuid) is
  'Called by dispatch-kyc-email EF after Resend send succeeds; service_role only.';

revoke all on function public.payment_mark_kyc_credenciamento_email_dispatched(uuid) from public;
revoke all on function public.payment_mark_kyc_credenciamento_email_dispatched(uuid) from anon;
revoke all on function public.payment_mark_kyc_credenciamento_email_dispatched(uuid) from authenticated;

grant execute on function public.payment_mark_kyc_credenciamento_email_dispatched(uuid) to service_role;

create or replace function public.payment_submit_provider_kyc(
  p_bank_institution_code text,
  p_bank_branch text,
  p_bank_account text,
  p_identity_doc_storage_path text,
  p_address_proof_storage_path text,
  p_pix_key text default null,
  p_phone text default null,
  p_legal_representative_phone text default null,
  p_corporate_charter_storage_path text default null,
  p_legal_rep_doc_storage_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_provider_id uuid := auth.uid();
  v_private public.provider_profiles_private%rowtype;
  v_gateway public.provider_gateway_accounts%rowtype;
  v_document text;
  v_from_state text;
  v_rate_limit jsonb;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for payment_submit_provider_kyc'
      using errcode = '42501';
  end if;

  v_rate_limit := public.platform_check_rate_limit(
    format('payment_submit_provider_kyc:%s', v_provider_id),
    3
  );

  if not coalesce((v_rate_limit->>'allowed')::boolean, false) then
    raise exception 'RATE_LIMITED'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_provider_id
      and p.role = 'provider'
  ) then
    raise exception 'PROVIDER_ROLE_REQUIRED'
      using
        errcode = '42501',
        detail = jsonb_build_object('code', 'PROVIDER_ROLE_REQUIRED')::text;
  end if;

  if p_bank_institution_code is null or trim(p_bank_institution_code) = ''
    or p_bank_branch is null or trim(p_bank_branch) = ''
    or p_bank_account is null or trim(p_bank_account) = ''
    or p_identity_doc_storage_path is null or trim(p_identity_doc_storage_path) = ''
    or p_address_proof_storage_path is null or trim(p_address_proof_storage_path) = '' then
    raise exception 'KYC_REQUIRED_FIELDS_MISSING'
      using errcode = '22023';
  end if;

  select *
  into v_private
  from public.provider_profiles_private ppp
  where ppp.provider_id = v_provider_id
  for update;

  if not found then
    raise exception 'PROVIDER_PROFILE_PRIVATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_private.entity_type = 'pf' then
    v_document := regexp_replace(coalesce(v_private.cpf, ''), '\D', '', 'g');
  else
    v_document := regexp_replace(coalesce(v_private.cnpj, ''), '\D', '', 'g');
  end if;

  if v_document = '' then
    raise exception 'PROVIDER_DOCUMENT_MISSING'
      using errcode = '22023';
  end if;

  perform public.payment_assert_provider_kyc_storage_path(
    v_provider_id,
    p_identity_doc_storage_path,
    'identity'
  );
  perform public.payment_assert_provider_kyc_storage_path(
    v_provider_id,
    p_address_proof_storage_path,
    'address-proof'
  );

  if v_private.entity_type = 'pj' then
    if p_corporate_charter_storage_path is null or trim(p_corporate_charter_storage_path) = ''
      or p_legal_rep_doc_storage_path is null or trim(p_legal_rep_doc_storage_path) = '' then
      raise exception 'KYC_PJ_DOCUMENTS_REQUIRED'
        using errcode = '22023';
    end if;

    perform public.payment_assert_provider_kyc_storage_path(
      v_provider_id,
      p_corporate_charter_storage_path,
      'corporate-charter'
    );
    perform public.payment_assert_provider_kyc_storage_path(
      v_provider_id,
      p_legal_rep_doc_storage_path,
      'legal-rep-id'
    );
  end if;

  select *
  into v_gateway
  from public.provider_gateway_accounts pga
  where pga.provider_id = v_provider_id
    and pga.gateway_slug = 'netcred'::public.payment_gateway_slug
  for update;

  if not found then
    insert into public.provider_gateway_accounts (
      provider_id,
      gateway_slug,
      document,
      onboarding_status
    )
    values (
      v_provider_id,
      'netcred'::public.payment_gateway_slug,
      v_document,
      'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
    )
    returning * into v_gateway;
  end if;

  if v_gateway.onboarding_status in (
    'ACTIVE'::public.payment_provider_onboarding_status,
    'SUSPENDED'::public.payment_provider_onboarding_status,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status,
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
  ) then
    raise exception 'INVALID_ONBOARDING_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'INVALID_ONBOARDING_STATE',
          'onboarding_status', v_gateway.onboarding_status
        )::text;
  end if;

  update public.provider_profiles_private ppp
  set
    bank_institution_code = trim(p_bank_institution_code),
    bank_branch = trim(p_bank_branch),
    bank_account = trim(p_bank_account),
    pix_key = nullif(trim(p_pix_key), ''),
    legal_representative_phone = nullif(trim(p_legal_representative_phone), ''),
    identity_doc_storage_path = trim(p_identity_doc_storage_path),
    address_proof_storage_path = trim(p_address_proof_storage_path),
    corporate_charter_storage_path = nullif(trim(p_corporate_charter_storage_path), ''),
    legal_rep_doc_storage_path = nullif(trim(p_legal_rep_doc_storage_path), ''),
    updated_at = now()
  where ppp.provider_id = v_provider_id;

  if p_phone is not null and trim(p_phone) <> '' then
    update public.profiles p
    set phone = trim(p_phone)
    where p.id = v_provider_id
      and nullif(trim(p.phone), '') is null;
  end if;

  v_from_state := v_gateway.onboarding_status::text;

  update public.provider_gateway_accounts pga
  set
    document = v_document,
    onboarding_status = 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
    onboarding_submitted_at = now(),
    email_dispatched_at = null,
    updated_at = now()
  where pga.id = v_gateway.id
  returning * into v_gateway;

  perform public.payment_write_audit(
    p_event_type := 'KYC_SUBMITTED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := v_gateway.id,
    p_from_state := v_from_state,
    p_to_state := 'DOCUMENTS_SUBMITTED',
    p_actor := 'client',
    p_actor_id := v_provider_id,
    p_metadata := jsonb_build_object(
      'entity_type', v_private.entity_type,
      'document_last4', right(v_document, 4)
    )
  );

  return jsonb_build_object(
    'provider_gateway_account_id', v_gateway.id,
    'onboarding_status', v_gateway.onboarding_status,
    'email_dispatched', false,
    'dispatch_kyc_email_required', true
  );
end;
$$;

comment on function public.payment_submit_provider_kyc(
  text, text, text, text, text, text, text, text, text, text
) is
  'Atomic provider KYC persist: profiles_private storage paths, gateway DOCUMENTS_SUBMITTED, audit. Email via dispatch-kyc-email EF.';

revoke all on function public.payment_submit_provider_kyc(
  text, text, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.payment_submit_provider_kyc(
  text, text, text, text, text, text, text, text, text, text
) from anon;
revoke all on function public.payment_submit_provider_kyc(
  text, text, text, text, text, text, text, text, text, text
) from service_role;

grant execute on function public.payment_submit_provider_kyc(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;
