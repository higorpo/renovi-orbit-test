-- pgTAP: payment Task 42 — payment_activate_provider_from_netcred activation invariants.

begin;

select plan(8);

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
  $$ select public.payment_activate_provider_from_netcred(
    gen_random_uuid(), 'company-1', 'bank-1'
  ) $$,
  '42501',
  'service_role required for payment_activate_provider_from_netcred',
  'rejects non-service_role callers'
);

select pg_temp.payment_set_service_role();

select throws_ok(
  $$ select public.payment_activate_provider_from_netcred(
    gen_random_uuid(), '', 'bank-1'
  ) $$,
  '22023',
  'NETCRED_IDS_REQUIRED',
  'rejects empty netcred company id'
);

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_account_id uuid;
begin
  -- Seed provider may already be ACTIVE (terminal); recreate for activation flow.
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
    'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
  )
  returning id into v_account_id;

  perform set_config('test.activate.account_id', v_account_id::text, true);
end;
$seed$;

select throws_ok(
  $$ select public.payment_activate_provider_from_netcred(
    current_setting('test.activate.account_id')::uuid,
    'company-1',
    'bank-1'
  ) $$,
  'P0001',
  'INVALID_ONBOARDING_STATE',
  'rejects PENDING_DOCUMENTS onboarding state'
);

update public.provider_gateway_accounts
set onboarding_status = 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
where id = current_setting('test.activate.account_id')::uuid;

create temp table _activate_result as
select public.payment_activate_provider_from_netcred(
  current_setting('test.activate.account_id')::uuid,
  'netcred-company-42',
  'netcred-bank-42'
) as payload;

select is(
  (select payload->>'onboarding_status' from _activate_result),
  'ACTIVE',
  'transitions gateway account to ACTIVE'
);

select is(
  (
    select pga.netcred_company_id
    from public.provider_gateway_accounts pga
    where pga.id = current_setting('test.activate.account_id')::uuid
  ),
  'netcred-company-42',
  'persists netcred_company_id'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    where pal.event_type = 'PROVIDER_ACTIVATED'
      and pal.entity_type = 'provider_gateway_account'
      and pal.entity_id = current_setting('test.activate.account_id')::uuid
      and pal.to_state = 'ACTIVE'
  ),
  'writes PROVIDER_ACTIVATED audit row'
);

select ok(
  exists (
    select 1
    from public.payment_events pe
    where pe.event_type = 'ProviderCredentialed'
      and pe.aggregate_type = 'provider_gateway_account'
      and pe.aggregate_id = current_setting('test.activate.account_id')::uuid
  ),
  'writes ProviderCredentialed domain event'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'PROVIDER_ACTIVATED'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_activate_provider_from_netcred'
  ),
  'payment_activate_provider_from_netcred emits PROVIDER_ACTIVATED'
);

select * from finish();
rollback;
