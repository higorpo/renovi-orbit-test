-- pgTAP: dispatch schema constraints (matching M5).

begin;

select plan(3);

-- Clear leftover visibility from seeds/crons for the seed SR + provider pair.
delete from public.service_request_provider_visibility
where service_request_id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  and provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;

select ok(
  to_regtype('public.service_request_dispatch_status') is not null,
  'service_request_dispatch_status enum exists'
);

select lives_ok(
  $$
  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'batch',
    now()
  )
  $$,
  'first batch visibility row inserts'
);

select throws_ok(
  $$
  insert into public.service_request_provider_visibility (
    service_request_id,
    provider_id,
    source,
    granted_at
  )
  values (
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'batch',
    now()
  )
  $$,
  '23505',
  null,
  'duplicate active batch visibility raises unique_violation'
);

select finish();

rollback;
