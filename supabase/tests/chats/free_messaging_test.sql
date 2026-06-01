-- pgTAP: proposal-gated free messaging (task 102, Req. 34, R34-AC14).
-- Scenarios: Discovery OK; PENDING fail; REVISION OK; re-PENDING fail; REJECTED OK.

begin;

\ir fixtures/seed_chat.inc

select plan(10);

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

create or replace function pg_temp.cns_gate_seed_sr()
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
    'Free messaging gate pgTAP fixture',
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

create or replace function pg_temp.cns_gate_submit(
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
    from public.calculate_provider_service_pricing(199.00::numeric)
  )
  select public.submit_proposal(
    p_chat_id,
    p_idempotency_key,
    pricing.original_amount,
    'Gate test proposal',
    1,
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

create temp table _gate_sr as
select pg_temp.cns_gate_seed_sr() as service_request_id;

create temp table _gate_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _gate_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

-- (1) Discovery: free messaging allowed; cns_send_message succeeds.
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  public.cns_chat_free_messaging_allowed((select chat_id from _gate_chat)),
  'discovery: cns_chat_free_messaging_allowed is true'
);

select lives_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1020001-0001-4001-8001-000000000001'::uuid,
      jsonb_build_object('text', 'Discovery phase message'),
      (select chat_id from _gate_chat),
      null
    );
  $sql$,
  'discovery: cns_send_message succeeds without PENDING proposal'
);

-- (2) PENDING: gate false; cns_send_message rejected.
select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _gate_submit_v1 as
select pg_temp.cns_gate_submit(
  (select chat_id from _gate_chat),
  'f1020002-0002-4002-8002-000000000002'::uuid
) as response;

select ok(
  not public.cns_chat_free_messaging_allowed((select chat_id from _gate_chat)),
  'pending: cns_chat_free_messaging_allowed is false'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1020003-0003-4003-8003-000000000003'::uuid,
      jsonb_build_object('text', 'Blocked while PENDING'),
      (select chat_id from _gate_chat),
      null
    );
  $sql$,
  'P0001',
  'FREE_MESSAGING_DISABLED_PROPOSAL_PENDING',
  'pending: cns_send_message rejects free TEXT'
);

-- (3) REVISION_REQUESTED: gate true; cns_send_message succeeds.
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.request_proposal_revision(
  (select (response->'proposal'->>'id')::uuid from _gate_submit_v1),
  'f1020004-0004-4004-8004-000000000004'::uuid,
  'REDUCE_SCOPE'::public.proposal_revision_reason,
  'Adjust pricing'
);

select ok(
  public.cns_chat_free_messaging_allowed((select chat_id from _gate_chat)),
  'revision requested: cns_chat_free_messaging_allowed is true'
);

select lives_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1020005-0005-4005-8005-000000000005'::uuid,
      jsonb_build_object('text', 'Revision negotiation message'),
      (select chat_id from _gate_chat),
      null
    );
  $sql$,
  'revision requested: cns_send_message succeeds'
);

-- (4) New PENDING after resubmit: gate false again.
select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _gate_submit_v2 as
select pg_temp.cns_gate_submit(
  (select chat_id from _gate_chat),
  'f1020006-0006-4006-8006-000000000006'::uuid
) as response;

select ok(
  not public.cns_chat_free_messaging_allowed((select chat_id from _gate_chat)),
  're-pending: cns_chat_free_messaging_allowed is false'
);

select throws_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1020007-0007-4007-8007-000000000007'::uuid,
      jsonb_build_object('text', 'Blocked after resubmit'),
      (select chat_id from _gate_chat),
      null
    );
  $sql$,
  'P0001',
  'FREE_MESSAGING_DISABLED_PROPOSAL_PENDING',
  're-pending: cns_send_message rejects free TEXT again'
);

-- (5) REJECTED: gate true; cns_send_message succeeds.
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.reject_proposal(
  (select (response->'proposal'->>'id')::uuid from _gate_submit_v2),
  'f1020008-0008-4008-8008-000000000008'::uuid,
  'Client declined revised offer'
);

select ok(
  public.cns_chat_free_messaging_allowed((select chat_id from _gate_chat)),
  'rejected: cns_chat_free_messaging_allowed is true'
);

select lives_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f1020009-0009-4009-8009-000000000009'::uuid,
      jsonb_build_object('text', 'Post-rejection message'),
      (select chat_id from _gate_chat),
      null
    );
  $sql$,
  'rejected: cns_send_message succeeds after REJECTED'
);

select finish();

rollback;
