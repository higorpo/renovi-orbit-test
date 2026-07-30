-- pgTAP: reschedule adjustment creates a new PROPOSED round (SUPERSEDED history).

begin;

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

select plan(15);

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_sr_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_pricing record;
  v_slot jsonb;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_sr_id, sr.client_id, sr.service_id, sr.address_id,
    format('service reschedule rounds %s', v_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_auth(v_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 11, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_sr_id, v_pricing.original_amount,
    'service reschedule rounds proposal', 2, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
    scheduled_shift, agreed_slot, status
  )
  values (
    v_service_id, v_sr_id, v_proposal_id, v_client_id, v_provider_id,
    'days', 2, current_date + 10, current_date + 11, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.chats (
    service_request_id, client_id, provider_id, status, last_interaction_at
  )
  values (v_sr_id, v_client_id, v_provider_id, 'ACTIVE', now())
  on conflict (service_request_id, provider_id) do update
    set status = excluded.status, last_interaction_at = excluded.last_interaction_at;

  perform set_config('test.rounds_service_id', v_service_id::text, true);
  perform set_config('test.rounds_client_id', v_client_id::text, true);
  perform set_config('test.rounds_provider_id', v_provider_id::text, true);
end;
$seed$;

select pg_temp.cns_set_auth(current_setting('test.rounds_client_id')::uuid);

create temp table _rounds_request as
select public.cns_request_service_reschedule(
  current_setting('test.rounds_service_id')::uuid,
  gen_random_uuid(),
  null
) as response;

select pg_temp.cns_set_auth(current_setting('test.rounds_provider_id')::uuid);

create temp table _rounds_propose1 as
select public.cns_propose_service_reschedule(
  (select (response->>'reschedule_request_id')::uuid from _rounds_request),
  jsonb_build_object(
    'start_date', to_char(current_date + 12, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 13, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  ),
  gen_random_uuid()
) as response;

select is(
  (select response->>'reschedule_request_id' from _rounds_propose1),
  (select response->>'reschedule_request_id' from _rounds_request),
  'first propose updates the same request row'
);

select pg_temp.cns_set_auth(current_setting('test.rounds_client_id')::uuid);

create temp table _rounds_adjust as
select public.cns_request_reschedule_adjustment(
  (select (response->>'reschedule_request_id')::uuid from _rounds_propose1),
  gen_random_uuid()
) as response;

select is(
  (select response->'reschedule'->'active_request'->>'status' from _rounds_adjust),
  'ADJUSTMENT_REQUESTED',
  'adjustment moves active request to ADJUSTMENT_REQUESTED'
);

select pg_temp.cns_set_auth(current_setting('test.rounds_provider_id')::uuid);

create temp table _rounds_propose2 as
select public.cns_propose_service_reschedule(
  (select (response->>'reschedule_request_id')::uuid from _rounds_propose1),
  jsonb_build_object(
    'start_date', to_char(current_date + 14, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 15, 'YYYY-MM-DD'),
    'shift', 'morning'
  ),
  gen_random_uuid()
) as response;

select isnt(
  (select response->>'reschedule_request_id' from _rounds_propose2),
  (select response->>'reschedule_request_id' from _rounds_propose1),
  're-propose after adjustment creates a new request id'
);

select is(
  (select response->>'superseded_request_id' from _rounds_propose2),
  (select response->>'reschedule_request_id' from _rounds_propose1),
  're-propose returns superseded_request_id of the previous round'
);

select is(
  (
    select srr.status::text
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _rounds_propose1)
  ),
  'SUPERSEDED',
  'previous round is marked SUPERSEDED'
);

select is(
  (
    select srr.parent_request_id::text
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _rounds_propose2)
  ),
  (select response->>'reschedule_request_id' from _rounds_propose1),
  'new round points to parent_request_id'
);

select is(
  (
    select public.cns_get_service_reschedule_request(
      (select (response->>'reschedule_request_id')::uuid from _rounds_propose1)
    )->'active_request'->>'status'
  ),
  'SUPERSEDED',
  'historical get by old request id returns SUPERSEDED snapshot'
);

select is(
  (
    select public.cns_get_service_reschedule_request(
      (select (response->>'reschedule_request_id')::uuid from _rounds_propose2)
    )->'active_request'->>'status'
  ),
  'PROPOSED',
  'historical get by new request id returns PROPOSED snapshot'
);

select is(
  (
    select srr.proposed_slot->>'start_date'
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _rounds_propose1)
  ),
  to_char(current_date + 12, 'YYYY-MM-DD'),
  'superseded row preserves first proposed slot in database'
);

select is(
  (
    select public.cns_get_service_reschedule_request(
      (select (response->>'reschedule_request_id')::uuid from _rounds_propose1)
    )->'request'->'proposed_slot'->>'start_date'
  ),
  to_char(current_date + 12, 'YYYY-MM-DD'),
  'historical snapshot for superseded request preserves first proposed slot'
);

select is(
  (
    select public.cns_get_service_reschedule_request(
      (select (response->>'reschedule_request_id')::uuid from _rounds_propose2)
    )->'request'->'proposed_slot'->>'start_date'
  ),
  to_char(current_date + 14, 'YYYY-MM-DD'),
  'historical snapshot for new round returns new proposed slot'
);

select is(
  (select response->'superseded_reschedule'->'request'->>'status' from _rounds_propose2),
  'SUPERSEDED',
  're-propose returns inline superseded_reschedule snapshot'
);

select is(
  (select response->'superseded_reschedule'->'request'->'proposed_slot'->>'start_date' from _rounds_propose2),
  to_char(current_date + 12, 'YYYY-MM-DD'),
  'inline superseded_reschedule preserves first proposed slot'
);

select pg_temp.cns_set_auth(current_setting('test.rounds_client_id')::uuid);

create temp table _rounds_accept as
select public.cns_accept_service_reschedule(
  (select (response->>'reschedule_request_id')::uuid from _rounds_propose2),
  gen_random_uuid()
) as response;

select is(
  (
    select srr.status::text
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _rounds_propose2)
  ),
  'ACCEPTED',
  'accept on child round transitions PROPOSED to ACCEPTED'
);

select is(
  (
    select srr.parent_request_id::text
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _rounds_propose2)
  ),
  (select response->>'reschedule_request_id' from _rounds_propose1),
  'accepted child round keeps parent_request_id for history'
);

select * from finish();

rollback;
