-- pgTAP: list_provider_opportunities batch arm (matching M12a).

begin;

select plan(6);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Clear leftover batch visibility so opportunity counts stay exact.
delete from public.service_request_provider_visibility
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

-- Close leftover fallback-open market from crons/prior committed state.
update public.service_request_dispatches
set
  status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status,
  fallback_opened_at = null,
  next_batch_at = null
where fallback_opened_at is not null
   or status = 'DISPATCH_FALLBACK_OPEN_MARKET'::public.service_request_dispatch_status;

create or replace function pg_temp.matching_seed_open_service_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
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
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching feed pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _feed_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _feed_sr),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'batch',
  now()
);

select is(
  jsonb_array_length(
    public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'
  ),
  1,
  'batch visibility returns opportunity for provider'
);

select is(
  public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'->0->>'service_icon_key',
  'Zap',
  'feed item includes platform_services.icon_key'
);

select is(
  public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'->0->>'service_color_key',
  'yellow_orange',
  'feed item includes platform_services.color_key'
);

select set_config('request.jwt.claim.sub', '4cf92e3a-64cd-4491-998e-9163138f8e96'::text, true);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', '4cf92e3a-64cd-4491-998e-9163138f8e96')::text,
  true
);

create temp table _feed_proposal_pricing as
select * from public.calculate_provider_service_pricing(100.00::numeric);

insert into public.provider_proposals (
  provider_id,
  service_request_id,
  proposed_amount,
  proposal_description,
  proposal_duration_value,
  proposal_duration_unit,
  proposal_suggested_slots,
  photos,
  tax_rate,
  tax_amount,
  final_amount,
  pricing_signature,
  status,
  version,
  revision_count,
  submitted_at
)
select
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  (select service_request_id from _feed_sr),
  p.original_amount,
  'feed exclusion test',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', to_char(current_date + 1, 'YYYY-MM-DD'),
      'shift', 'morning'
    )
  ),
  '{}'::text[],
  p.tax_rate,
  p.tax_amount,
  p.final_amount,
  p.pricing_signature,
  'PENDING'::public.proposal_status,
  1,
  0,
  now()
from _feed_proposal_pricing p;

select is(
  jsonb_array_length(
    public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'
  ),
  0,
  'in-flight proposal excludes service request from feed'
);

update public.service_request_dispatches
set status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
where service_request_id = (select service_request_id from _feed_sr);

delete from public.provider_proposals
where service_request_id = (select service_request_id from _feed_sr);

select is(
  jsonb_array_length(
    public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid)->'items'
  ),
  1,
  'EXPIRED dispatch still shows persisted batch visibility'
);

update public.profiles
set operational_status = 'suspended'::public.provider_operational_status
where id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid;

select is(
  public.list_provider_opportunities('4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid),
  jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'has_more', false),
  'suspended provider receives empty feed'
);

select finish();

rollback;
