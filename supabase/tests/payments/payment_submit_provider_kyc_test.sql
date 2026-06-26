-- pgTAP: payment Task 21 — payment_submit_provider_kyc RPC.

begin;

select plan(4);

create or replace function pg_temp.payment_set_provider_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select throws_ok(
  $$ select public.payment_submit_provider_kyc(
    '001', '0001', '12345-6',
    'providers/x/kyc/identity/a.pdf',
    'providers/x/kyc/address-proof/b.pdf'
  ) $$,
  '42501',
  'Authentication required for payment_submit_provider_kyc',
  'rejects unauthenticated callers'
);

select pg_temp.payment_set_provider_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

insert into storage.objects (id, bucket_id, name, owner, metadata)
values
  (
    gen_random_uuid(),
    'provider-kyc-documents',
    'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/doc.pdf',
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    '{}'::jsonb
  ),
  (
    gen_random_uuid(),
    'provider-kyc-documents',
    'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/address-proof/doc.pdf',
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    '{}'::jsonb
  );

create temp table _kyc_submit_result as
select public.payment_submit_provider_kyc(
  '001',
  '0001',
  '12345-6',
  'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/doc.pdf',
  'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/address-proof/doc.pdf'
) as payload;

select is(
  (select payload->>'onboarding_status' from _kyc_submit_result),
  'DOCUMENTS_SUBMITTED',
  'transitions provider gateway account to DOCUMENTS_SUBMITTED'
);

select ok(
  (select (payload->>'dispatch_kyc_email_required')::boolean from _kyc_submit_result),
  'returns dispatch_kyc_email_required for post-commit EF'
);

select ok(
  exists (
    select 1
    from public.payment_audit_log pal
    join public.provider_gateway_accounts pga
      on pga.id = pal.entity_id
    where pal.event_type = 'KYC_SUBMITTED'
      and pal.entity_type = 'provider_gateway_account'
      and pga.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'writes KYC_SUBMITTED audit log entry'
);

select finish();

rollback;
