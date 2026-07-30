-- pgTAP: provider KYC upload sessions + orphan janitor.

begin;

select plan(8);

create or replace function pg_temp.payment_set_auth(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end;
$$;

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_janitor_orphan_kyc_documents'
  ),
  'payment_janitor_orphan_kyc_documents is SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.payment_janitor_orphan_kyc_documents(int)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.payment_janitor_orphan_kyc_documents(int)', 'EXECUTE'),
  'service_role only may execute payment_janitor_orphan_kyc_documents'
);

-- Seed provider is ACTIVE; delete gateway so KYC storage mutations are allowed.
delete from public.provider_gateway_accounts
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  and gateway_slug = 'netcred'::public.payment_gateway_slug;

select pg_temp.payment_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _kyc_session_result as
select public.payment_create_provider_kyc_upload_session('identity') as payload;

select ok(
  (select payload->>'upload_session_id' is not null from _kyc_session_result),
  'payment_create_provider_kyc_upload_session returns session id'
);

select is(
  (select payload->>'storage_path_prefix' from _kyc_session_result),
  'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/',
  'create session returns expected storage path prefix'
);

-- Janitor is service_role/postgres only; drop authenticated role from helper.
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'service_role')::text,
  true
);

do $orphan$
declare
  v_provider uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_orphan_id uuid := gen_random_uuid();
  v_recent_id uuid := gen_random_uuid();
  v_path text := format(
    'providers/%s/kyc/identity/orphan-doc.pdf',
    v_provider
  );
begin
  insert into public.provider_kyc_upload_sessions (
    id,
    provider_id,
    status,
    document_key,
    storage_path,
    expires_at
  )
  values (
    v_orphan_id,
    v_provider,
    'pending',
    'identity',
    v_path,
    now() - interval '25 hours'
  );

  insert into public.provider_kyc_upload_sessions (
    id,
    provider_id,
    status,
    document_key,
    storage_path,
    expires_at
  )
  values (
    v_recent_id,
    v_provider,
    'pending',
    'address-proof',
    format('providers/%s/kyc/address-proof/recent-doc.pdf', v_provider),
    now() - interval '1 hour'
  );

  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'provider-kyc-documents',
    v_path,
    v_provider,
    jsonb_build_object('size', 2048)
  );

  perform set_config('test.kyc.orphan_session_id', v_orphan_id::text, true);
  perform set_config('test.kyc.recent_session_id', v_recent_id::text, true);
  perform set_config('test.kyc.orphan_path', v_path, true);
end;
$orphan$;

select is(
  (public.payment_janitor_orphan_kyc_documents(500)->>'expired_count')::int,
  1,
  'janitor expires one orphan session past retention window'
);

select is(
  (
    select s.status
    from public.provider_kyc_upload_sessions s
    where s.id = current_setting('test.kyc.orphan_session_id')::uuid
  ),
  'expired',
  'orphan session marked expired'
);

select ok(
  not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'provider-kyc-documents'
      and o.name = current_setting('test.kyc.orphan_path')
  ),
  'orphan storage object deleted'
);

select is(
  (
    select s.status
    from public.provider_kyc_upload_sessions s
    where s.id = current_setting('test.kyc.recent_session_id')::uuid
  ),
  'pending',
  'recent pending session left untouched'
);

select * from finish();
rollback;
