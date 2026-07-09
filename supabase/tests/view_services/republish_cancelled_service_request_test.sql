-- pgTAP: republish_cancelled_service_request ownership, eligibility, copy, and idempotency.

begin;

select plan(9);

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
end;
$$;

create temp table _republish_fixture as
select
  gen_random_uuid() as service_request_id,
  gen_random_uuid() as idempotency_key,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as other_user_id;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  photos,
  form_data,
  form_schema,
  form_version,
  status,
  cancelled_at,
  urgency,
  scope_complexity,
  tags,
  missing_info_warnings,
  suggested_equipment,
  suggested_materials,
  estimated_duration_hint
)
select
  (select service_request_id from _republish_fixture),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'Republish source fixture',
  'Descrição do pedido cancelado para republicação.',
  array['28e30f1d-3c47-441f-94c6-76b6ea0db470/republish_0.jpg']::text[],
  '{"tipo_servico":"nova"}'::jsonb,
  '{"version":"2.0"}'::jsonb,
  '2.0',
  'CANCELLED'::public.service_request_status,
  now(),
  'medium',
  'medium',
  array['residencial']::text[],
  array['aviso']::text[],
  array['drill']::text[],
  array['cable_wire']::text[],
  '4_to_8h'
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- Non-owner cannot republish
select pg_temp.cns_set_auth((select other_user_id from _republish_fixture));

select throws_ok(
  format(
    $sql$
      select public.republish_cancelled_service_request(
        '%s'::uuid,
        gen_random_uuid()
      );
    $sql$,
    (select service_request_id from _republish_fixture)
  ),
  '42501',
  'Only the service request client may republish',
  'non-owner cannot republish cancelled service request'
);

-- Owner republishes successfully
select pg_temp.cns_set_auth((select client_id from _republish_fixture));

create temp table _republish_result as
select public.republish_cancelled_service_request(
  (select service_request_id from _republish_fixture),
  (select idempotency_key from _republish_fixture)
) as payload;

select ok(
  (select (payload->>'requestId')::uuid is distinct from (select service_request_id from _republish_fixture)
   from _republish_result),
  'republish returns a new requestId distinct from the source'
);

select is(
  (
    select sr.status::text
    from public.service_requests sr
    where sr.id = (select (payload->>'requestId')::uuid from _republish_result)
  ),
  'OPEN',
  'republished service request status is OPEN'
);

select is(
  (
    select sr.title
    from public.service_requests sr
    where sr.id = (select (payload->>'requestId')::uuid from _republish_result)
  ),
  'Republish source fixture',
  'republished service request copies title'
);

select is(
  (
    select sr.photos
    from public.service_requests sr
    where sr.id = (select (payload->>'requestId')::uuid from _republish_result)
  ),
  array['28e30f1d-3c47-441f-94c6-76b6ea0db470/republish_0.jpg']::text[],
  'republished service request reuses photo paths'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = (select (payload->>'requestId')::uuid from _republish_result)
  ),
  1,
  'republish bootstraps matching dispatch for the new OPEN request'
);

-- Idempotent replay returns the same requestId without a second insert
select is(
  (
    select public.republish_cancelled_service_request(
      (select service_request_id from _republish_fixture),
      (select idempotency_key from _republish_fixture)
    )->>'requestId'
  ),
  (select payload->>'requestId' from _republish_result),
  'idempotent replay returns the same requestId'
);

-- Open (non-cancelled) request is rejected
create temp table _open_fixture as
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
  status
)
select
  (select service_request_id from _open_fixture),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'Open source fixture',
  'Pedido ainda aberto.',
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

select throws_ok(
  format(
    $sql$
      select public.republish_cancelled_service_request(
        '%s'::uuid,
        gen_random_uuid()
      );
    $sql$,
    (select service_request_id from _open_fixture)
  ),
  'P0001',
  'SR_NOT_CANCELLED',
  'non-cancelled service request cannot be republished'
);

-- Inactive address blocks republish
update public.client_addresses
set is_active = false
where id = (
  select address_id
  from public.service_requests
  where id = (select service_request_id from _republish_fixture)
);

select throws_ok(
  format(
    $sql$
      select public.republish_cancelled_service_request(
        '%s'::uuid,
        gen_random_uuid()
      );
    $sql$,
    (select service_request_id from _republish_fixture)
  ),
  '42501',
  'address does not belong to actor or is inactive',
  'inactive address cannot be republished'
);

select * from finish();

rollback;
