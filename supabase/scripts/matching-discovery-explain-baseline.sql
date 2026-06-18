-- One-off EXPLAIN baseline for matching_discover_candidates (task 52).
-- Run: yarn supabase db query --local -f supabase/scripts/matching-discovery-explain-baseline.sql

DO $$
DECLARE
  v_sr_id uuid := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;
  v_i int;
  v_provider_id uuid;
  v_lat float8;
  v_lng float8;
  v_h3_res int;
BEGIN
  v_h3_res := public.platform_constant_int('matching.h3_resolution', 7);

  FOR v_i IN 1..50 LOOP
    v_provider_id := gen_random_uuid();
    v_lat := -23.5505 + (random() - 0.5) * 0.3;
    v_lng := -46.6333 + (random() - 0.5) * 0.3;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_provider_id,
      'authenticated',
      'authenticated',
      v_provider_id::text || '@perf.local',
      crypt('x', gen_salt('bf')),
      now(),
      '{"provider":"email"}'::jsonb,
      json_build_object('full_name', 'Perf Provider', 'role', 'provider')::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO public.profiles (id, role, full_name, operational_status)
    VALUES (v_provider_id, 'provider', 'Perf Provider ' || v_i, 'active');

    INSERT INTO public.provider_service_areas (provider_id, service_id, is_active)
    SELECT v_provider_id, sr.service_id, true
    FROM public.service_requests sr
    WHERE sr.id = v_sr_id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.provider_latest_locations (
      provider_id,
      location,
      h3_index,
      location_recorded_at,
      device_id
    )
    VALUES (
      v_provider_id,
      extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
      public.matching_latlng_to_h3_cell(
        extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
        v_h3_res
      ),
      now(),
      'perf-' || v_i
    );
  END LOOP;
END $$;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.matching_discover_candidates(
  '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
  200
);
