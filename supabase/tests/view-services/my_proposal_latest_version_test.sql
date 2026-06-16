-- pgTAP: my_proposal must follow proposal version, not updated_at from terminal transitions.

begin;

select plan(4);

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

-- Sole REJECTED_AUTOMATICALLY row must still surface (e.g. SR cancel bulk reject).
create temp table _rejected_auto_case as
select
  pp.id as proposal_id,
  pp.service_request_id,
  pp.provider_id
from public.provider_proposals pp
where pp.service_request_id = '8017e003-5a32-44e7-b8da-1727a14f4d03'::uuid
  and pp.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
limit 1;

update public.provider_proposals
set
  status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
  client_rejection_response = 'Pedido encerrado automaticamente.'
where id = (select proposal_id from _rejected_auto_case);

select pg_temp.cns_set_auth((select provider_id from _rejected_auto_case));

select is(
  (
    select public.project_service_row(
      (select service_request_id from _rejected_auto_case),
      (select provider_id from _rejected_auto_case)
    )->'negotiation'->'my_proposal'->>'id'
  ),
  (select proposal_id::text from _rejected_auto_case),
  'my_proposal includes REJECTED_AUTOMATICALLY when it is the latest version'
);

create temp table _my_proposal_case as
select
  '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid as service_request_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id,
  (
    select id from public.provider_proposals
    where service_request_id = '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid
      and provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and version = 1
  ) as older_proposal_id,
  (
    select id from public.provider_proposals
    where service_request_id = '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid
      and provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and version = 2
  ) as newer_proposal_id;

-- Older version expired later (updated_at bumped) while newer version stays PENDING.
update public.provider_proposals
set
  status = 'EXPIRED'::public.proposal_status,
  updated_at = '2026-06-15 00:00:00+00',
  expired_at = '2026-06-15 00:00:00+00'
where id = (select older_proposal_id from _my_proposal_case);

update public.provider_proposals
set
  status = 'PENDING'::public.proposal_status,
  updated_at = '2026-06-11 00:00:00+00',
  expired_at = null
where id = (select newer_proposal_id from _my_proposal_case);

select pg_temp.cns_set_auth((select provider_id from _my_proposal_case));

select is(
  (
    select public.project_service_row(
      (select service_request_id from _my_proposal_case),
      (select provider_id from _my_proposal_case)
    )->'negotiation'->'my_proposal'->>'id'
  ),
  (select newer_proposal_id::text from _my_proposal_case),
  'my_proposal returns highest version even when older row has newer updated_at'
);

select is(
  (
    select public.project_service_row(
      (select service_request_id from _my_proposal_case),
      (select provider_id from _my_proposal_case)
    )->'negotiation'->'my_proposal'->>'status'
  ),
  'PENDING',
  'my_proposal status matches the latest version row'
);

select ok(
  (
    select jsonb_array_length(
      public.list_services(
        p_page := 1,
        p_page_size := 20,
        p_list_phase := 'negotiation'
      )->'items'
    ) >= 1
  ),
  'list_services still returns items after my_proposal fix'
);

select * from finish();
rollback;
