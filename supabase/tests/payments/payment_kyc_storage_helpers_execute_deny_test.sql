-- pgTAP: anon/authenticated cannot EXECUTE KYC storage helpers; DEFINER owner retains EXECUTE.

begin;

select plan(8);

select ok(
  not has_function_privilege(
    'anon',
    'public.payment_provider_kyc_storage_path_valid(uuid, text)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE payment_provider_kyc_storage_path_valid'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_provider_kyc_storage_path_valid(uuid, text)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE payment_provider_kyc_storage_path_valid'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.payment_assert_provider_kyc_storage_path(uuid, text, text)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE payment_assert_provider_kyc_storage_path'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_assert_provider_kyc_storage_path(uuid, text, text)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE payment_assert_provider_kyc_storage_path'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE payment_link_provider_kyc_upload_sessions_by_paths'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.payment_provider_kyc_storage_path_valid(uuid, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.payment_assert_provider_kyc_storage_path(uuid, text, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])',
    'EXECUTE'
  ),
  'service_role can EXECUTE KYC storage helpers'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.payment_provider_kyc_storage_path_valid(uuid, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'postgres',
    'public.payment_assert_provider_kyc_storage_path(uuid, text, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'postgres',
    'public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])',
    'EXECUTE'
  ),
  'postgres owner retains EXECUTE on KYC helpers for DEFINER wrappers'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.payment_submit_provider_kyc(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)',
    'EXECUTE'
  ),
  'authenticated still has EXECUTE on payment_submit_provider_kyc wrapper'
);

select finish();

rollback;
