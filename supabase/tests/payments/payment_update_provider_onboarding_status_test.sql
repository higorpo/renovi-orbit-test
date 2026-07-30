-- pgTAP: payment Task 43 — payment_update_provider_onboarding_status invariants.

begin;

select plan(7);

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

select throws_ok(
  $$ select public.payment_update_provider_onboarding_status(
    gen_random_uuid(),
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) $$,
  '42501',
  'service_role required for payment_update_provider_onboarding_status',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_update_provider_onboarding_status(
    gen_random_uuid(),
    'ACTIVE'::public.payment_provider_onboarding_status
  ) $$,
  '22023',
  'UNSUPPORTED_ONBOARDING_STATUS',
  'rejects ACTIVE as intermediate target'
);

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_account_id uuid;
begin
  -- Seed provider is ACTIVE (terminal); delete then insert DOCUMENTS_SUBMITTED.
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
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
  )
  returning id into v_account_id;

  perform set_config('test.onboarding.account_id', v_account_id::text, true);
end;
$seed$;

create temp table _review_result as
select public.payment_update_provider_onboarding_status(
  current_setting('test.onboarding.account_id')::uuid,
  'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
) as payload;

select is(
  (select payload->>'onboarding_status' from _review_result),
  'UNDER_NETCRED_REVIEW',
  'transitions gateway account to UNDER_NETCRED_REVIEW'
);

select ok(
  (
    select pga.netcred_company_id is null
      and pga.netcred_bank_account_id is null
    from public.provider_gateway_accounts pga
    where pga.id = current_setting('test.onboarding.account_id')::uuid
  ),
  'does not persist netcred ids on UNDER_NETCRED_REVIEW'
);

create temp table _noop_result as
select public.payment_update_provider_onboarding_status(
  current_setting('test.onboarding.account_id')::uuid,
  'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
) as payload;

select ok(
  (select (payload->>'noop')::boolean from _noop_result),
  'second call to same target state is idempotent noop'
);

update public.provider_gateway_accounts
set
  onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
  netcred_company_id = 'test-company-id',
  netcred_bank_account_id = 'test-bank-id'
where id = current_setting('test.onboarding.account_id')::uuid;

select ok(
  (
    select (public.payment_update_provider_onboarding_status(
      current_setting('test.onboarding.account_id')::uuid,
      'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
    )->>'reason') = 'already_active'
  ),
  'does not downgrade ACTIVE accounts'
);

do $seed_pending$
declare
  v_pending_account_id uuid := gen_random_uuid();
  v_provider_id uuid := '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;
begin
  insert into public.provider_gateway_accounts (
    id,
    provider_id,
    gateway_slug,
    document,
    onboarding_status
  )
  values (
    v_pending_account_id,
    v_provider_id,
    'netcred',
    '98765432100',
    'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
  );

  perform set_config('test.onboarding.pending_account_id', v_pending_account_id::text, true);
end;
$seed_pending$;

select throws_ok(
  $$ select public.payment_update_provider_onboarding_status(
    current_setting('test.onboarding.pending_account_id')::uuid,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) $$,
  'P0001',
  'INVALID_ONBOARDING_STATE',
  'rejects transition from PENDING_DOCUMENTS'
);

select * from finish();
rollback;
