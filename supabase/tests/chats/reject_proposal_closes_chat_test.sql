-- pgTAP: reject_proposal closes an open provider-client chat with PROPOSAL_REJECTED.

begin;

\ir fixtures/seed_chat.inc

select plan(5);

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

create or replace function pg_temp.cns_seed_reject_close_sr()
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
    'reject closes chat pgTAP fixture',
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

create temp table _reject_close_sr as
select pg_temp.cns_seed_reject_close_sr() as service_request_id;

create temp table _reject_close_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _reject_close_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _reject_close_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _reject_close_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Reject close chat test',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 2)::text,
      'shift', 'morning'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.reject_proposal(
  (select (response->'proposal'->>'id')::uuid from _reject_close_submit),
  'f1040001-0001-4001-8001-000000000001'::uuid,
  'Client declined and closed chat'
);

select is(
  (
    select c.status::text
    from public.chats c
    where c.id = (select chat_id from _reject_close_chat)
  ),
  'CLOSED',
  'reject_proposal closes the provider-client chat'
);

select is(
  (
    select c.closure_type::text
    from public.chats c
    where c.id = (select chat_id from _reject_close_chat)
  ),
  'PROPOSAL_REJECTED',
  'reject_proposal sets PROPOSAL_REJECTED closure type'
);

select is(
  (
    select c.closed_by_user_id::text
    from public.chats c
    where c.id = (select chat_id from _reject_close_chat)
  ),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  'reject_proposal records the client as closed_by_user_id'
);

select is(
  (
    select c.closure_reason
    from public.chats c
    where c.id = (select chat_id from _reject_close_chat)
  ),
  'Client declined and closed chat',
  'reject_proposal stores the rejection reason as closure_reason'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1040002-0002-4002-8002-000000000002'::uuid,
      jsonb_build_object('text', 'Blocked after rejection close'),
      (select chat_id from _reject_close_chat),
      null
    );
  $sql$,
  'P0001',
  'CONVERSATION_CLOSED',
  'reject_proposal prevents further free messaging in the closed chat'
);

select * from finish();
rollback;
