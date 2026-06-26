-- pgTAP: payment Task 27 — cns_initiate_conversation credentialing gate.

begin;

select plan(1);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
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

create temp table _credentialing_sr as
select gen_random_uuid() as service_request_id;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency
)
select
  sr_fixture.service_request_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  sr.service_id,
  sr.address_id,
  'credentialing gate pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _credentialing_sr sr_fixture
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

select throws_ok(
  format(
    $$ select public.cns_initiate_conversation(
      %L::uuid,
      gen_random_uuid()
    ) $$,
    (select service_request_id from _credentialing_sr)
  ),
  'P0001',
  'PROVIDER_NOT_CREDENTIALED',
  'denies chat initiation for non-ACTIVE provider'
);

select finish();

rollback;
