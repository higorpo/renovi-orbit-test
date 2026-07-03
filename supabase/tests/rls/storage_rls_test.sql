-- pgTAP: storage.objects RLS policies for Orbit buckets.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(11);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);

select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Storage Admin');

-- Seed storage objects as superuser (bypasses RLS) ----------------------------

reset role;

delete from storage.objects
where bucket_id in ('profile-images', 'service-requests', 'provider-portfolio-images')
  and name like '%rls-test%';

insert into storage.objects (id, bucket_id, name, owner, metadata)
values
  (
    gen_random_uuid(),
    'profile-images',
    'users/' || current_setting('rls.client_id') || '/profile/rls-test-avatar.jpg',
    current_setting('rls.client_id')::uuid,
    '{}'::jsonb
  ),
  (
    gen_random_uuid(),
    'service-requests',
    current_setting('rls.client_id') || '/rls-test_photo.jpg',
    current_setting('rls.client_id')::uuid,
    '{}'::jsonb
  ),
  (
    gen_random_uuid(),
    'provider-portfolio-images',
    'providers/' || current_setting('rls.provider_id') || '/rls-test-item1.jpg',
    current_setting('rls.provider_id')::uuid,
    '{}'::jsonb
  );

-- profile-images: authenticated can read bucket --------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from storage.objects
    where bucket_id = 'profile-images'
      and name like '%rls-test%'
  ),
  'authenticated reads profile-images (storage_objects_profile_images_select_authenticated)'
);

select pg_temp.rls_set_anon();

select is(
  (
    select count(*)::int
    from storage.objects
    where bucket_id = 'profile-images' and name like '%rls-test%'
  ),
  0,
  'anon cannot read profile-images'
);

-- service-requests: client reads own folder ------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from storage.objects
    where bucket_id = 'service-requests'
      and name like '%rls-test%'
  ),
  'client reads own service-requests folder (storage_objects_service_requests_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from storage.objects
    where bucket_id = 'service-requests'
  ),
  'provider reads service-requests bucket (storage_objects_service_requests_select)'
);

-- portfolio: public provider profile visible ----------------------------------

select pg_temp.rls_set_anon();

select ok(
  (
    select count(*) >= 1
    from storage.objects
    where bucket_id = 'provider-portfolio-images'
      and name like '%' || current_setting('rls.provider_id') || '%'
  ),
  'anon reads portfolio when provider profile public (storage_objects_portfolio_images_select)'
);

-- profile-images: own folder write only ---------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select lives_ok(
  format(
    $q$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'profile-images',
        'users/%s/profile/rls-test-own.jpg',
        '%s',
        '{}'::jsonb
      )
    $q$,
    current_setting('rls.client_id'),
    current_setting('rls.client_id')
  ),
  'client inserts into own profile-images folder (storage_objects_profile_images_insert)'
);

select is(
  (
    select count(*)::int
    from storage.objects
    where bucket_id = 'profile-images'
      and name = 'users/' || current_setting('rls.provider_id') || '/profile/rls-test-forged.jpg'
  ),
  0,
  'client cannot see foreign profile folder object (storage_objects_profile_images_insert deny)'
);

-- chat-media: insert denied for authenticated ---------------------------------

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('chat-media', '00000000-0000-0000-0000-000000000001/session/file.jpg', auth.uid(), '{}'::jsonb)
  $$,
  '42501',
  null,
  'authenticated cannot INSERT chat-media (storage_objects_chat_media_insert_denied)'
);

-- Structural policy counts ----------------------------------------------------

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
  ),
  22,
  'storage.objects has 22 RLS policies'
);

select ok(
  (
    select exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'storage_objects_chat_media_select'
    )
  ),
  'storage_objects_chat_media_select policy exists'
);

select ok(
  (
    select exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'storage_objects_proposal_images_select'
    )
  ),
  'storage_objects_proposal_images_select policy exists'
);

select finish();

rollback;
