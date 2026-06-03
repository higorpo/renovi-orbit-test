-- pgTAP: accept_proposal happy path (CNS task 31, design §4.4).

begin;

\ir fixtures/seed_chat.inc

select plan(6);

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

create or replace function pg_temp.cns_seed_accept_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
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
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'accept_proposal pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'accept_proposal'
  ),
  'accept_proposal is SECURITY DEFINER'
);

create temp table _accept_sr as
select pg_temp.cns_seed_accept_sr() as service_request_id;

create temp table _accept_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

create temp table _accept_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _accept_sr),
  pricing.original_amount,
  'Accept cascade test proposal',
  2,
  'hours',
  jsonb_build_array((select selected_slot from _accept_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _accept_result as
select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _accept_submit),
  (select selected_slot from _accept_slot),
  'f2222222-2222-4222-8222-222222222222'::uuid
) as response;

select is(
  (select response->'proposal'->>'status' from _accept_result),
  'ACCEPTED',
  'accept sets proposal status to ACCEPTED'
);

select is(
  (
    select status::text
    from public.service_requests
    where id = (select service_request_id from _accept_sr)
  ),
  'COMPLETED',
  'accept sets service request to COMPLETED'
);

select ok(
  (
    select exists (
      select 1
      from public.services s
      where s.id = (select (response->'service'->>'id')::uuid from _accept_result)
        and s.status = 'PENDING_PAYMENT'::public.contracted_service_status
    )
  ),
  'accept inserts contracted services row'
);

select is(
  (
    select count(*)::int
    from public.chats c
    where c.service_request_id = (select service_request_id from _accept_sr)
      and c.status = 'CLOSED'::public.cns_conversation_status
  ),
  1,
  'accept closes all chats on the service request'
);

select ok(
  (
    select exists (
      select 1
      from public.domain_events de
      where de.event_type = 'PROPOSAL_ACCEPTED'
        and de.aggregate_id = (
          select (submit_response->'proposal'->>'id')::uuid from _accept_submit
        )
    )
    and exists (
      select 1
      from public.domain_events de
      where de.event_type = 'SERVICE_REQUEST_COMPLETED'
        and de.service_request_id = (select service_request_id from _accept_sr)
    )
    and exists (
      select 1
      from public.domain_events de
      where de.event_type = 'CHATS_CLOSED_BULK'
        and de.service_request_id = (select service_request_id from _accept_sr)
    )
  ),
  'accept emits PROPOSAL_ACCEPTED, SERVICE_REQUEST_COMPLETED, and CHATS_CLOSED_BULK events'
);

select finish();

rollback;
