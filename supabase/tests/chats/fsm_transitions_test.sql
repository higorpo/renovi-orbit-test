-- pgTAP: CNS FSM transition orchestration (task 101, design §4, Req. 32).
-- Covers send, submit, accept, reject, revision, close, cancel, expire, reciprocity.

begin;

\ir fixtures/seed_chat.inc
\ir fixtures/seed_reciprocity_messages.inc

select plan(15);

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

create or replace function pg_temp.cns_fsm_seed_sr()
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
    'CNS FSM pgTAP fixture',
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

create or replace function pg_temp.cns_fsm_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid default '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id uuid default '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  p_status public.cns_conversation_status default 'ACTIVE',
  p_last_interaction_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
begin
  return pg_temp.cns_seed_chat(
    p_service_request_id := p_service_request_id,
    p_client_id := p_client_id,
    p_provider_id := p_provider_id,
    p_status := p_status,
    p_last_interaction_at := p_last_interaction_at
  );
end;
$$;

create or replace function pg_temp.cns_fsm_submit(
  p_chat_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_response jsonb;
begin
  with pricing as (
    select *
    from public.calculate_provider_service_pricing(275.00::numeric)
  )
  select public.submit_proposal(
    p_chat_id,
    p_idempotency_key,
    pricing.original_amount,
    'FSM suite proposal',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', (current_date + 2)::text,
        'shift', 'morning'
      )
    ),
    pricing.pricing_signature,
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount
  )
  into v_response
  from pricing;

  return v_response;
end;
$$;

-- send → ACTIVE conversation
create temp table _send_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _send_result as
select public.cns_send_message(
  'TEXT'::public.cns_message_type,
  'f1010001-0001-4001-8001-000000000001'::uuid,
  jsonb_build_object('text', 'FSM send path'),
  null,
  (select service_request_id from _send_sr)
) as response;

select is(
  (select response->'conversation'->>'status' from _send_result),
  'ACTIVE',
  'send path leaves conversation ACTIVE'
);

select ok(
  (
    select exists (
      select 1
      from public.chat_messages m
      where m.chat_id = (select (response->'conversation'->>'id')::uuid from _send_result)
        and m.message_type = 'TEXT'::public.cns_message_type
    )
  ),
  'send path persists TEXT timeline row'
);

-- submit → PENDING
create temp table _submit_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _submit_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _submit_sr)) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _submit_result as
select pg_temp.cns_fsm_submit(
  (select chat_id from _submit_chat),
  'f1010002-0002-4002-8002-000000000002'::uuid
) as response;

select is(
  (select response->'proposal'->>'status' from _submit_result),
  'PENDING',
  'submit path reaches PENDING proposal terminal gate'
);

-- reject → REJECTED (terminal)
create temp table _reject_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _reject_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _reject_sr)) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _reject_submit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _reject_chat),
  'f1010003-0003-4003-8003-000000000003'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _reject_result as
select public.reject_proposal(
  (select (response->'proposal'->>'id')::uuid from _reject_submit),
  'f1010004-0004-4004-8004-000000000004'::uuid,
  'FSM reject path'
) as response;

select is(
  (select response->'proposal'->>'status' from _reject_result),
  'REJECTED',
  'reject path reaches REJECTED terminal proposal state'
);

-- revision → REVISION_REQUESTED → resubmit PENDING v2
create temp table _revision_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _revision_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _revision_sr)) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _revision_submit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _revision_chat),
  'f1010005-0005-4005-8005-000000000005'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _revision_request as
select public.request_proposal_revision(
  (select (response->'proposal'->>'id')::uuid from _revision_submit),
  'f1010006-0006-4006-8006-000000000006'::uuid,
  'REDUCE_SCOPE'::public.proposal_revision_reason,
  'Please adjust scope'
) as response;

select is(
  (select response->'proposal'->>'status' from _revision_request),
  'REVISION_REQUESTED',
  'revision path reaches REVISION_REQUESTED'
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _revision_resubmit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _revision_chat),
  'f1010007-0007-4007-8007-000000000007'::uuid
) as response;

select is(
  (select response->'proposal'->>'status' from _revision_resubmit),
  'PENDING',
  'revision resubmit returns new PENDING proposal'
);

select is(
  (select response->'proposal'->>'version' from _revision_resubmit),
  '2',
  'revision resubmit increments proposal version'
);

-- accept → ACCEPTED / COMPLETED / service / CLOSED (no partial accept)
create temp table _accept_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _accept_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _accept_sr)) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

create temp table _accept_submit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _accept_chat),
  'f1010008-0008-4008-8008-000000000008'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _accept_result as
select public.accept_proposal(
  (select (response->'proposal'->>'id')::uuid from _accept_submit),
  (select selected_slot from _accept_slot),
  'f1010009-0009-4009-8009-000000000009'::uuid
) as response;

select ok(
  (
    select (response->'proposal'->>'status') = 'ACCEPTED'
      and exists (
        select 1
        from public.services s
        where s.id = (select (response->'service'->>'id')::uuid from _accept_result)
          and s.status = 'PENDING_PAYMENT'::public.contracted_service_status
      )
      and (
        select status::text
        from public.service_requests
        where id = (select service_request_id from _accept_sr)
      ) = 'COMPLETED'
      and (
        select count(*)::int
        from public.chats c
        where c.service_request_id = (select service_request_id from _accept_sr)
          and c.status <> 'CLOSED'::public.cns_conversation_status
      ) = 0
    from _accept_result
  ),
  'accept path atomically reaches ACCEPTED, COMPLETED SR, service row, and all chats CLOSED'
);

select throws_ok(
  $sql$
    select public.accept_proposal(
      (select (response->'proposal'->>'id')::uuid from _accept_submit),
      (select selected_slot from _accept_slot),
      'f101000a-000a-400a-800a-00000000000a'::uuid
    );
  $sql$,
  'P0001',
  'SR_ALREADY_COMPLETED',
  'duplicate accept is rejected after SR completed'
);

-- manual close → CLOSED
create temp table _close_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _close_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _close_sr)) as chat_id;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _close_result as
select public.cns_close_conversation(
  (select chat_id from _close_chat),
  'f101000b-000b-400b-800b-00000000000b'::uuid,
  true,
  'FSM manual close'
) as response;

select is(
  (select response->'conversation'->>'status' from _close_result),
  'CLOSED',
  'close path reaches CLOSED conversation terminal state'
);

-- cancel → CANCELLED SR + CLOSED chats + REJECTED_AUTOMATICALLY proposals
create temp table _cancel_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _cancel_chat as
select pg_temp.cns_fsm_seed_chat((select service_request_id from _cancel_sr)) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _cancel_submit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _cancel_chat),
  'f101000c-000c-400c-800c-00000000000c'::uuid
) as response;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cancel_service_request(
  (select service_request_id from _cancel_sr),
  'f101000d-000d-400d-800d-00000000000d'::uuid
);

select is(
  (
    select status::text
    from public.service_requests
    where id = (select service_request_id from _cancel_sr)
  ),
  'CANCELLED',
  'cancel path reaches CANCELLED service request terminal state'
);

select is(
  (
    select status::text
    from public.chats
    where id = (select chat_id from _cancel_chat)
  ),
  'CLOSED',
  'cancel path closes conversation'
);

select is(
  (
    select status::text
    from public.provider_proposals
    where id = (select (response->'proposal'->>'id')::uuid from _cancel_submit)
  ),
  'REJECTED_AUTOMATICALLY',
  'cancel path auto-rejects pending proposal'
);

-- expire → EXPIRED
create temp table _expire_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _expire_chat as
select pg_temp.cns_fsm_seed_chat(
  (select service_request_id from _expire_sr),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'ACTIVE'::public.cns_conversation_status,
  now() - interval '30 hours'
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _expire_submit as
select pg_temp.cns_fsm_submit(
  (select chat_id from _expire_chat),
  'f101000e-000e-400e-800e-00000000000e'::uuid
) as response;

update public.provider_proposals
set submitted_at = now() - interval '25 hours'
where id = (select (response->'proposal'->>'id')::uuid from _expire_submit);

select public.expire_pending_proposals(500);

select is(
  (
    select status::text
    from public.provider_proposals
    where id = (select (response->'proposal'->>'id')::uuid from _expire_submit)
  ),
  'EXPIRED',
  'expire path reaches EXPIRED proposal terminal state'
);

-- reciprocity batch → INACTIVE
create temp table _reciprocity_sr as
select pg_temp.cns_fsm_seed_sr() as service_request_id;

create temp table _reciprocity_chat as
select pg_temp.cns_fsm_seed_chat(
  (select service_request_id from _reciprocity_sr),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'ACTIVE'::public.cns_conversation_status,
  now() - interval '25 hours'
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

select is(
  (
    select status::text
    from public.chats
    where id = (select chat_id from _reciprocity_chat)
  ),
  'INACTIVE',
  'reciprocity path reaches INACTIVE conversation terminal state'
);

select finish();

rollback;
