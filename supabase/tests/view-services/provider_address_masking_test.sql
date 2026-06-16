-- pgTAP: provider address masking in get_service / list_services (via project_service_row).

begin;

select plan(5);

select ok(
  to_regprocedure('public.provider_sees_full_service_address(uuid, uuid)') is not null,
  'provider_sees_full_service_address helper exists'
);

select ok(
  not public.provider_sees_full_service_address(
    gen_random_uuid(),
    gen_random_uuid()
  ),
  'unknown service/provider returns false for full address gate'
);

create temp table _addr_mask_sr as
select
  sr.id as service_request_id,
  sr.client_id,
  sr.address_id
from public.service_requests sr
where sr.status = 'OPEN'::public.service_request_status
limit 1;

select ok(
  (select count(*) from _addr_mask_sr) = 1,
  'fixture open service request exists'
);

select ok(
  not public.provider_sees_full_service_address(
    (select service_request_id from _addr_mask_sr),
    gen_random_uuid()
  ),
  'random provider without proposal does not pass full address gate'
);

select ok(
  (
    select public.project_service_row(
      (select service_request_id from _addr_mask_sr),
      p.id
    )->'request'->'address' ? 'street'
    from public.profiles p
    where p.role = 'provider'
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.service_request_id = (select service_request_id from _addr_mask_sr)
          and pp.provider_id = p.id
          and pp.status = 'ACCEPTED'::public.proposal_status
      )
    limit 1
  ) = false,
  'project_service_row masks street for provider without accepted proposal'
);

select * from finish();
rollback;
