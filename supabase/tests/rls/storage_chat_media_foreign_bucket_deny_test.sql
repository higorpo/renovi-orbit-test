-- pgTAP: dropping chat-media *_denied policies must not open foreign-bucket writes.
-- Authenticated clients must not INSERT into service-requests / chat-media / foreign KYC;
-- own profile-images path remains allowed (positive control).
-- Helpers inlined (avoid \ir — CLI container breaks on paths with spaces).

begin;

create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

select plan(5);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

-- Foreign bucket: service-requests (no authenticated INSERT policy; Edge/service_role only)
select throws_ok(
  format(
    $q$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'service-requests',
        '%s/rls-foreign-bucket-deny.jpg',
        '%s',
        '{}'::jsonb
      )
    $q$,
    current_setting('rls.client_id'),
    current_setting('rls.client_id')
  ),
  '42501',
  null,
  'authenticated cannot INSERT into service-requests bucket'
);

-- chat-media: default deny (no positive INSERT for authenticated)
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'chat-media',
      '00000000-0000-0000-0000-000000000001/session/rls-deny.jpg',
      auth.uid(),
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'authenticated cannot INSERT into chat-media bucket'
);

-- Positive control: own profile-images path still succeeds
select lives_ok(
  format(
    $q$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'profile-images',
        'users/%s/profile/rls-chat-media-fix-own.jpg',
        '%s',
        '{}'::jsonb
      )
    $q$,
    current_setting('rls.client_id'),
    current_setting('rls.client_id')
  ),
  'authenticated can INSERT into own profile-images path'
);

-- Foreign KYC path under provider-kyc-documents must fail for client
select throws_ok(
  format(
    $q$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'provider-kyc-documents',
        'providers/%s/kyc/identity/rls-foreign-kyc.jpg',
        '%s',
        '{}'::jsonb
      )
    $q$,
    current_setting('rls.provider_id'),
    current_setting('rls.client_id')
  ),
  '42501',
  null,
  'client cannot INSERT into foreign provider-kyc-documents path'
);

-- Structural: the overly permissive denied policies must be gone
select ok(
  (
    select count(*)::int = 0
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'storage_objects_chat_media_insert_denied',
        'storage_objects_chat_media_update_denied',
        'storage_objects_chat_media_delete_denied'
      )
  ),
  'storage_objects_chat_media_*_denied policies are dropped'
);

select finish();

rollback;
