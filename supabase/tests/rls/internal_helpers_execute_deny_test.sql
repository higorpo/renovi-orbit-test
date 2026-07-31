-- pgTAP: client EXECUTE denied on remaining internal helpers from revoke migration.

begin;

select plan(10);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.resolve_proposal_chat_id(uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE resolve_proposal_chat_id'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.resolve_proposal_chat_id(uuid, uuid)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE resolve_proposal_chat_id'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.resolve_proposal_chat_id(uuid, uuid)',
    'EXECUTE'
  ),
  'service_role can EXECUTE resolve_proposal_chat_id'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_calculate_charge_amount(uuid, numeric, smallint)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE payment_calculate_charge_amount'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.payment_calculate_charge_amount(uuid, numeric, smallint)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE payment_calculate_charge_amount'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.payment_calculate_charge_amount(uuid, numeric, smallint)',
    'EXECUTE'
  ),
  'service_role can EXECUTE payment_calculate_charge_amount'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cns_service_reschedule_active_request_id(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE cns_service_reschedule_active_request_id'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_service_reschedule_active_request_id(uuid)',
    'EXECUTE'
  ),
  'service_role can EXECUTE cns_service_reschedule_active_request_id'
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
    'postgres',
    'public.resolve_proposal_chat_id(uuid, uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'postgres',
    'public.payment_calculate_charge_amount(uuid, numeric, smallint)',
    'EXECUTE'
  )
  and has_function_privilege(
    'postgres',
    'public.cns_service_reschedule_active_request_id(uuid)',
    'EXECUTE'
  ),
  'postgres owner retains EXECUTE for DEFINER wrappers'
);

select finish();

rollback;
