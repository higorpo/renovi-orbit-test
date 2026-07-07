-- pgTAP: notification triggers (chat + proposal); domain_events no longer emitted for live mutations.

begin;

\ir fixtures/seed_chat.inc
\ir ../fixtures/accept_proposal_payment_helpers.inc

select plan(11);

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

create or replace function pg_temp.cns_seed_notify_sr()
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
    'notification_triggers pgTAP fixture',
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

-- 1. Chat message TEXT → MMD push, no domain_events.
create temp table _chat_msg_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _chat_msg_send as
select public.cns_send_message(
  'TEXT'::public.cns_message_type,
  'a1111111-1111-4111-8111-111111111111'::uuid,
  jsonb_build_object('text', 'Trigger test message'),
  null,
  (select service_request_id from _chat_msg_sr)
) as response;

select ok(
  (
    select exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'chat.new_message'
        and d.profile_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
        and d.bypass_limits = true
        and d.channel = 'push'::message_dispatcher.message_channel
    )
    and not exists (
      select 1
      from public.domain_events de
      where de.event_type = 'CHAT_MESSAGE_SENT'
        and de.chat_id = (select (response->'conversation'->>'id')::uuid from _chat_msg_send)
    )
  ),
  'cns_send_message(TEXT) enqueues chat.new_message push without domain_events'
);

-- 2. PROPOSAL timeline INSERT does not enqueue chat.new_message.
create temp table _proposal_filter_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _proposal_filter_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _proposal_filter_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

insert into public.chat_messages (
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key
)
values (
  (select chat_id from _proposal_filter_chat),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'PROPOSAL'::public.cns_message_type,
  jsonb_build_object('proposal_id', gen_random_uuid()),
  'f10100aa-00aa-40aa-80aa-0000000000aa'::uuid
);

select ok(
  not exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.template_key = 'chat.new_message'
      and d.template_variables->>'chat_id' = (select chat_id::text from _proposal_filter_chat)
  ),
  'PROPOSAL chat_messages INSERT does not enqueue chat.new_message'
);

-- 3. create_provider_proposal → proposal.submitted dispatches, no domain_events.
create temp table _submit_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _submit_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _submit_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _submit_result as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _submit_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Trigger submit test',
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

select ok(
  (
    select exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'proposal.submitted'
        and d.profile_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
    )
    and not exists (
      select 1
      from public.domain_events de
      where de.event_type = 'PROPOSAL_SUBMITTED'
        and de.aggregate_id = (
          select (response->'proposal'->>'id')::uuid from _submit_result
        )
    )
  ),
  'create_provider_proposal enqueues proposal.submitted without domain_events'
);

select ok(
  (
    select exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'proposal.submitted'
        and d.profile_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
        and d.channel = 'push'::message_dispatcher.message_channel
        and d.bypass_limits = true
    )
    and exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'proposal.submitted'
        and d.profile_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
        and d.channel = 'email'::message_dispatcher.message_channel
        and d.bypass_limits = false
    )
  ),
  'proposal.submitted push bypasses limits; email keeps default limits'
);

-- 4. reject_proposal manual → proposal.rejected for provider.
create temp table _reject_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _reject_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _reject_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _reject_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _reject_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Reject trigger test',
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
  (select (response->'proposal'->>'id')::uuid from _reject_submit),
  'b2222222-2222-4222-8222-222222222222'::uuid,
  'Manual reject trigger test'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.template_key = 'proposal.rejected'
      and d.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'reject_proposal notifies provider via proposal.rejected'
);

-- 5. REJECTED_AUTOMATICALLY does not notify.
create temp table _auto_reject_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _auto_reject_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _auto_reject_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _auto_reject_proposal as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select (response->'proposal'->>'id')::uuid as proposal_id
from (
  select public.create_provider_proposal(
    (select service_request_id from _auto_reject_sr),
    gen_random_uuid(),
    pricing.original_amount,
    'Auto reject trigger test',
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
  from pricing
) s;

update public.provider_proposals
set
  status = 'REJECTED_AUTOMATICALLY'::public.proposal_status,
  client_rejection_response = 'Superseded by newer proposal',
  updated_at = now()
where id = (select proposal_id from _auto_reject_proposal);

select ok(
  not exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.template_key = 'proposal.rejected'
      and d.metadata->>'proposal_id' = (select proposal_id::text from _auto_reject_proposal)
  ),
  'REJECTED_AUTOMATICALLY status change does not enqueue proposal.rejected'
);

-- 6. Manual close → chat.closed for other participant.
create temp table _manual_close_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _manual_close_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _manual_close_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cns_close_conversation(
  (select chat_id from _manual_close_chat),
  'c3333333-3333-4333-8333-333333333333'::uuid,
  true,
  'Manual close trigger test'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.template_key = 'chat.closed'
      and d.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'cns_close_conversation notifies other participant on manual close'
);

-- 7. Bulk close (PROPOSAL_ACCEPTED_ELSEWHERE) → no chat.closed dispatch.
create temp table _bulk_close_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _bulk_close_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _bulk_close_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

update public.chats
set
  status = 'CLOSED'::public.cns_conversation_status,
  closed_at = now(),
  closure_type = 'PROPOSAL_ACCEPTED_ELSEWHERE'::public.cns_closure_type,
  updated_at = now()
where id = (select chat_id from _bulk_close_chat);

select ok(
  not exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.template_key = 'chat.closed'
      and d.metadata->>'chat_id' = (select chat_id::text from _bulk_close_chat)
  ),
  'bulk PROPOSAL_ACCEPTED_ELSEWHERE close does not enqueue chat.closed'
);

-- 8. accept/cancel: no migrated domain_events nor SR notification dispatches.
create temp table _sr_flow_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _sr_flow_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _sr_flow_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _sr_flow_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _sr_flow_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'SR flow trigger test',
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

select pg_temp.cns_accept_proposal_with_payment(
  (select (response->'proposal'->>'id')::uuid from _sr_flow_submit),
  jsonb_build_object(
    'start_date', (current_date + 2)::text,
    'shift', 'morning'
  ),
  'd4444444-4444-4444-8444-444444444444'::uuid
);

create temp table _sr_cancel_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _sr_cancel_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _sr_cancel_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cancel_service_request(
  (select service_request_id from _sr_cancel_sr),
  'e5555555-5555-4555-8555-555555555555'::uuid
);

select ok(
  (
    not exists (
      select 1
      from public.domain_events de
      where de.service_request_id in (
        select service_request_id from _sr_flow_sr
        union all
        select service_request_id from _sr_cancel_sr
      )
        and de.event_type in (
          'PROPOSAL_ACCEPTED',
          'SERVICE_REQUEST_COMPLETED',
          'CHATS_CLOSED_BULK',
          'SERVICE_REQUEST_CANCELLED',
          'NEGOTIATION_TERMINATED'
        )
    )
    and not exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key in ('service_request.completed', 'service_request.cancelled')
    )
  ),
  'accept and cancel do not emit migrated domain_events or SR MMD dispatches'
);

-- 9. Reciprocity batch: no CONVERSATION_INACTIVATED / SLOT_RELEASED domain_events.
\ir fixtures/seed_reciprocity_messages.inc

create temp table _reciprocity_sr as
select pg_temp.cns_seed_notify_sr() as service_request_id;

create temp table _reciprocity_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _reciprocity_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  p_status := 'ACTIVE'::public.cns_conversation_status,
  p_last_interaction_at := now() - interval '25 hours'
) as chat_id;

insert into public.service_request_negotiation_stats (
  service_request_id,
  active_chat_count
)
values ((select service_request_id from _reciprocity_sr), 1)
on conflict (service_request_id) do update
  set active_chat_count = 1;

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _reciprocity_chat),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select public.cns_evaluate_reciprocity_batch(500);

select ok(
  not exists (
    select 1
    from public.domain_events de
    where de.chat_id = (select chat_id from _reciprocity_chat)
      and de.event_type in ('CONVERSATION_INACTIVATED', 'SLOT_RELEASED')
  ),
  'cns_evaluate_reciprocity_batch does not emit CONVERSATION_INACTIVATED or SLOT_RELEASED'
);

-- 10. Idempotency: duplicate send does not duplicate push dispatch.
select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    where d.idempotency_key = public.mmd_idempotency_uuid(
      format(
        'chat_message:%s:push',
        (select response->'message'->>'id' from _chat_msg_send)
      )
    )
  ),
  1,
  'duplicate idempotent send does not duplicate MMD push dispatch'
);

select finish();

rollback;
