-- pgTAP: REJECTED onboarding transitions allow resubmit / reset.

begin;

select plan(4);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_account_id uuid;
begin
  -- Seed provider is ACTIVE (terminal); delete then insert REJECTED for FSM tests.
  delete from public.provider_gateway_accounts
  where provider_id = v_provider_id
    and gateway_slug = 'netcred'::public.payment_gateway_slug;

  insert into public.provider_gateway_accounts (
    id,
    provider_id,
    gateway_slug,
    document,
    onboarding_status
  )
  values (
    gen_random_uuid(),
    v_provider_id,
    'netcred',
    '12345678901',
    'REJECTED'::public.payment_provider_onboarding_status
  )
  returning id into v_account_id;

  perform set_config('test.onboarding.rejected_account_id', v_account_id::text, true);
end;
$seed$;

select lives_ok(
  $$
    update public.provider_gateway_accounts
    set onboarding_status = 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
    where id = current_setting('test.onboarding.rejected_account_id')::uuid
  $$,
  'REJECTED → DOCUMENTS_SUBMITTED is allowed (resubmit)'
);

select is(
  (
    select onboarding_status::text
    from public.provider_gateway_accounts
    where id = current_setting('test.onboarding.rejected_account_id')::uuid
  ),
  'DOCUMENTS_SUBMITTED',
  'account reaches DOCUMENTS_SUBMITTED after REJECTED resubmit transition'
);

update public.provider_gateway_accounts
set onboarding_status = 'REJECTED'::public.payment_provider_onboarding_status
where id = current_setting('test.onboarding.rejected_account_id')::uuid;

select lives_ok(
  $$
    update public.provider_gateway_accounts
    set onboarding_status = 'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
    where id = current_setting('test.onboarding.rejected_account_id')::uuid
  $$,
  'REJECTED → PENDING_DOCUMENTS is allowed (optional reset)'
);

-- Re-seed REJECTED (PENDING_DOCUMENTS → REJECTED is not a valid transition).
do $reseed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_account_id uuid;
begin
  delete from public.provider_gateway_accounts
  where provider_id = v_provider_id
    and gateway_slug = 'netcred'::public.payment_gateway_slug;

  insert into public.provider_gateway_accounts (
    id,
    provider_id,
    gateway_slug,
    document,
    onboarding_status
  )
  values (
    gen_random_uuid(),
    v_provider_id,
    'netcred',
    '12345678901',
    'REJECTED'::public.payment_provider_onboarding_status
  )
  returning id into v_account_id;

  perform set_config('test.onboarding.rejected_account_id', v_account_id::text, true);
end;
$reseed$;

select throws_ok(
  $$
    update public.provider_gateway_accounts
    set onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    where id = current_setting('test.onboarding.rejected_account_id')::uuid
  $$,
  'P0001',
  'PROVIDER_ONBOARDING_INVALID_TRANSITION',
  'REJECTED → ACTIVE remains blocked'
);

select * from finish();
rollback;
