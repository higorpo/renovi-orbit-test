-- pgTAP: authenticated cannot EXECUTE reschedule snapshot helper; wrapper still works.
-- Privilege-focused (no \ir fixture — CLI container path issues with spaces).

begin;

select plan(6);

create or replace function pg_temp.reschedule_snapshot_set_auth(p_user_id uuid)
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

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE cns_service_reschedule_snapshot_for_request'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE cns_service_reschedule_snapshot_for_request'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)',
    'EXECUTE'
  ),
  'service_role can EXECUTE cns_service_reschedule_snapshot_for_request'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cns_service_reschedule_active_request_id(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE cns_service_reschedule_active_request_id'
);

select pg_temp.reschedule_snapshot_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $sql$
    select public.cns_service_reschedule_snapshot_for_request(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
    )
  $sql$,
  '42501',
  null,
  'direct snapshot call as authenticated raises privilege denied'
);

-- Public wrapper remains executable for authenticated participants.
select ok(
  has_function_privilege(
    'authenticated',
    'public.cns_get_service_reschedule_request(uuid)',
    'EXECUTE'
  ),
  'authenticated retains EXECUTE on cns_get_service_reschedule_request wrapper'
);

select * from finish();

rollback;
