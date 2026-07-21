-- pgTAP: ACTIVE credentialing requires NetCred company + bank account (CHK-042f).

begin;

select plan(3);

-- Seeded provider from local seeds.
select set_config(
  'app.fix042f_provider',
  '5d09e025-20a2-4842-aeef-324d42a431e1',
  true
);

delete from public.provider_gateway_accounts
where provider_id = current_setting('app.fix042f_provider')::uuid;

insert into public.provider_gateway_accounts (
  provider_id,
  gateway_slug,
  onboarding_status,
  document,
  netcred_company_id,
  netcred_bank_account_id
)
values (
  current_setting('app.fix042f_provider')::uuid,
  'netcred',
  'ACTIVE',
  '12345678901',
  'company-fix042f',
  null
);

select is(
  public.payment_provider_is_credentialed(
    current_setting('app.fix042f_provider')::uuid
  ),
  false,
  'ACTIVE with company but null bank is not credentialed'
);

update public.provider_gateway_accounts
set netcred_bank_account_id = 'bank-fix042f'
where provider_id = current_setting('app.fix042f_provider')::uuid
  and gateway_slug = 'netcred';

select is(
  public.payment_provider_is_credentialed(
    current_setting('app.fix042f_provider')::uuid
  ),
  true,
  'ACTIVE with company+bank is credentialed'
);

-- Trigger: cannot move DOCUMENTS_SUBMITTED → ACTIVE without bank
delete from public.provider_gateway_accounts
where provider_id = current_setting('app.fix042f_provider')::uuid;

insert into public.provider_gateway_accounts (
  provider_id,
  gateway_slug,
  onboarding_status,
  document,
  netcred_company_id,
  netcred_bank_account_id
)
values (
  current_setting('app.fix042f_provider')::uuid,
  'netcred',
  'DOCUMENTS_SUBMITTED',
  '12345678901',
  'company-fix042f-2',
  null
);

select throws_ok(
  format(
    $sql$
      update public.provider_gateway_accounts
      set onboarding_status = 'ACTIVE'
      where provider_id = %L::uuid
        and gateway_slug = 'netcred'
    $sql$,
    current_setting('app.fix042f_provider')
  ),
  'P0001',
  'PROVIDER_NETCRED_BANK_ACCOUNT_ID_REQUIRED',
  'ACTIVE transition without bank raises PROVIDER_NETCRED_BANK_ACCOUNT_ID_REQUIRED'
);

select * from finish();
rollback;
