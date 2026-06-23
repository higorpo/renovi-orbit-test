-- pgTAP: service address coordinates visibility in project_service_row.

begin;

select plan(3);

create temp table _coord_sr as
select
  sr.id as service_request_id,
  sr.client_id,
  sr.address_id
from public.service_requests sr
where sr.status = 'OPEN'::public.service_request_status
limit 1;

select ok(
  (select count(*) from _coord_sr) = 1,
  'fixture open service request exists'
);

select ok(
  (
    select public.project_service_row(
      (select service_request_id from _coord_sr),
      p.id
    )->'request'->'address' ? 'latitude'
    from public.profiles p
    where p.role = 'provider'
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.service_request_id = (select service_request_id from _coord_sr)
          and pp.provider_id = p.id
          and pp.status = 'ACCEPTED'::public.proposal_status
      )
    limit 1
  ) = false,
  'project_service_row omits latitude for provider without accepted proposal'
);

select ok(
  (
    select public.project_service_row(
      (select service_request_id from _coord_sr),
      p.id
    )->'request'->'address' ? 'longitude'
    from public.profiles p
    where p.role = 'provider'
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.service_request_id = (select service_request_id from _coord_sr)
          and pp.provider_id = p.id
          and pp.status = 'ACCEPTED'::public.proposal_status
      )
    limit 1
  ) = false,
  'project_service_row omits longitude for provider without accepted proposal'
);

select * from finish();
rollback;
