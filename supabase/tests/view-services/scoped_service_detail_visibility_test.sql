-- pgTAP: scoped visibility in get_service / list_services (via project_service_row).

begin;

select plan(8);

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

-- Seeded SR with contracted service and accepted proposal for João Eletricista.
create temp table _scoped_sr as
select '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id;

create temp table _scoped_providers as
select
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as accepted_provider_id,
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid as other_provider_id;

-- Client sees proposal totals and contracted summary.
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select cmp_ok(
  (select (public.get_service((select service_request_id from _scoped_sr))->'negotiation'->>'proposal_count')::int),
  '>',
  0,
  'client get_service includes proposal_count'
);

select ok(
  (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'client get_service includes contracted summary'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'request' ? 'tags'),
  'client get_service omits tags from request payload'
);

-- Winning provider sees contracted summary but not global proposal_count.
select pg_temp.cns_set_auth((select accepted_provider_id::text from _scoped_providers)::uuid);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'negotiation' ? 'proposal_count'),
  'accepted provider get_service omits proposal_count'
);

select ok(
  (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'accepted provider get_service includes contracted summary'
);

-- Other provider must not see contracted summary or proposal_count.
select pg_temp.cns_set_auth((select other_provider_id::text from _scoped_providers)::uuid);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'negotiation' ? 'proposal_count'),
  'other provider get_service omits proposal_count'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'contracted' ? 'id'),
  'other provider get_service hides contracted summary'
);

select ok(
  not (select public.get_service((select service_request_id from _scoped_sr))->'request'->'address' ? 'street'),
  'other provider get_service keeps masked address'
);

select * from finish();
rollback;
