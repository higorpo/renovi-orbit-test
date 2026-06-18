-- pgTAP: comprehensive evaluate_service_request_dispatch_gates ladder (matching task 40).

begin;

reset role;

select plan(16);

\ir ../rls/fixtures/seed_rls_actors.inc
\ir ../chats/fixtures/seed_chat.inc

create or replace function pg_temp.dispatch_gates_seed_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid := gen_random_uuid();
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
    v_sr_id,
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'dispatch gates ladder pgTAP',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.dispatch_gates_seed_dispatch(
  p_service_request_id uuid,
  p_status public.service_request_dispatch_status default 'DISPATCH_ACTIVE',
  p_fallback_opened_at timestamptz default null,
  p_next_batch_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  v_dispatch_id uuid;
begin
  update public.service_request_dispatches
  set
    status = p_status,
    next_batch_at = coalesce(p_next_batch_at, now() + interval '1 hour'),
    fallback_opened_at = p_fallback_opened_at,
    updated_at = now()
  where service_request_id = p_service_request_id
  returning id into v_dispatch_id;

  if v_dispatch_id is not null then
    return v_dispatch_id;
  end if;

  insert into public.service_request_dispatches (
    service_request_id,
    status,
    next_batch_at,
    fallback_opened_at
  )
  values (
    p_service_request_id,
    p_status,
    coalesce(p_next_batch_at, now() + interval '1 hour'),
    p_fallback_opened_at
  )
  returning id into v_dispatch_id;

  return v_dispatch_id;
end;
$$;

create or replace function pg_temp.dispatch_gates_seed_pending_proposals(
  p_service_request_id uuid,
  p_count int
)
returns void
language plpgsql
as $$
declare
  v_provider_ids uuid[] := array[
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ];
  v_i int;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 1, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_pricing record;
begin
  for v_i in 1..p_count loop
    perform pg_temp.rls_set_auth(v_provider_ids[v_i]);
    select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);
    reset role;

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
    values (
      v_provider_ids[v_i],
      p_service_request_id,
      100.00,
      format('Gate ladder proposal %s', v_i),
      2,
      'hours',
      jsonb_build_array(v_slot),
      '{}'::text[],
      v_pricing.tax_rate,
      v_pricing.tax_amount,
      v_pricing.final_amount,
      v_pricing.pricing_signature,
      'PENDING'::public.proposal_status,
      1,
      0,
      now()
    );
  end loop;
end;
$$;

create or replace function pg_temp.dispatch_gates_seed_active_chats(
  p_service_request_id uuid,
  p_count int
)
returns void
language plpgsql
as $$
declare
  v_client_id uuid;
  v_provider_ids uuid[] := array[
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ];
  v_i int;
  v_chat_id uuid;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = p_service_request_id;

  for v_i in 1..p_count loop
    v_chat_id := pg_temp.cns_seed_chat(
      p_service_request_id,
      v_client_id,
      v_provider_ids[v_i],
      'ACTIVE'::public.cns_conversation_status,
      now()
    );

    insert into public.chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      payload,
      idempotency_key
    )
    values (
      v_chat_id,
      v_client_id,
      'TEXT'::public.cns_message_type,
      jsonb_build_object('text', format('gate ladder message %s', v_i)),
      gen_random_uuid()
    );
  end loop;
end;
$$;

update public.platform_constants
set value = '2'::jsonb
where key = 'chats.max_active_slots_per_service_request';

update public.platform_constants
set value = '2'::jsonb
where key = 'matching.dispatch_pause_active_chat_threshold';

-- 1) ACTIVE when no gate applies
create temp table _gate_active_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_active_sr),
  'DISPATCH_ACTIVE'::public.service_request_dispatch_status
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_active_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_active_sr)
  ),
  'DISPATCH_ACTIVE',
  'ACTIVE when no proposal or chat gate applies'
);

-- 2) STOPPED clears next_batch_at
create temp table _gate_stopped_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_stopped_sr),
  'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  null,
  now() + interval '2 hours'
);

select pg_temp.dispatch_gates_seed_pending_proposals((select service_request_id from _gate_stopped_sr), 2);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_stopped_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_stopped_sr)
  ),
  'DISPATCH_STOPPED',
  'STOPPED when in-flight proposal cap reached'
);

select ok(
  (
    select d.next_batch_at is null
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_stopped_sr)
  ),
  'STOPPED sets next_batch_at to NULL'
);

-- 3) STOPPED beats PAUSED
create temp table _gate_priority_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch((select service_request_id from _gate_priority_sr));
select pg_temp.dispatch_gates_seed_pending_proposals((select service_request_id from _gate_priority_sr), 2);
select pg_temp.dispatch_gates_seed_active_chats((select service_request_id from _gate_priority_sr), 2);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_priority_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_priority_sr)
  ),
  'DISPATCH_STOPPED',
  'STOPPED beats PAUSED when both gates fire'
);

-- 4) PAUSED clears next_batch_at
create temp table _gate_paused_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch((select service_request_id from _gate_paused_sr));
select pg_temp.dispatch_gates_seed_active_chats((select service_request_id from _gate_paused_sr), 2);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_paused_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_paused_sr)
  ),
  'DISPATCH_PAUSED',
  'PAUSED when active chat threshold met'
);

select ok(
  (
    select d.next_batch_at is null
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_paused_sr)
  ),
  'PAUSED sets next_batch_at to NULL'
);

-- 5) FALLBACK when fallback_opened_at is set
create temp table _gate_fallback_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_fallback_sr),
  'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  now()
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_fallback_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_fallback_sr)
  ),
  'DISPATCH_FALLBACK_OPEN_MARKET',
  'FALLBACK when fallback_opened_at is set'
);

select ok(
  (
    select d.next_batch_at is null
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_fallback_sr)
  ),
  'FALLBACK sets next_batch_at to NULL'
);

-- 6) DISPATCH_PENDING preserved when no higher gate applies
create temp table _gate_pending_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_pending_sr),
  'DISPATCH_PENDING'::public.service_request_dispatch_status
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_pending_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_pending_sr)
  ),
  'DISPATCH_PENDING',
  'DISPATCH_PENDING unchanged when no higher gate applies'
);

-- 7–9) terminal states are no-op
create temp table _gate_terminal_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_terminal_sr),
  'DISPATCH_MATCHED'::public.service_request_dispatch_status
);

select pg_temp.dispatch_gates_seed_pending_proposals((select service_request_id from _gate_terminal_sr), 2);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_terminal_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_terminal_sr)
  ),
  'DISPATCH_MATCHED',
  'DISPATCH_MATCHED is terminal (no-op)'
);

update public.service_request_dispatches
set status = 'DISPATCH_CANCELLED'::public.service_request_dispatch_status
where service_request_id = (select service_request_id from _gate_terminal_sr);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_terminal_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_terminal_sr)
  ),
  'DISPATCH_CANCELLED',
  'DISPATCH_CANCELLED is terminal (no-op)'
);

update public.service_request_dispatches
set status = 'DISPATCH_EXPIRED'::public.service_request_dispatch_status
where service_request_id = (select service_request_id from _gate_terminal_sr);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_terminal_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_terminal_sr)
  ),
  'DISPATCH_EXPIRED',
  'DISPATCH_EXPIRED is terminal (no-op)'
);

-- 10) resume STOPPED -> ACTIVE sets next_batch_at to now()
create temp table _gate_resume_stopped_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_resume_stopped_sr),
  'DISPATCH_STOPPED'::public.service_request_dispatch_status,
  null,
  null
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_resume_stopped_sr));

select ok(
  (
    select d.status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status
      and d.next_batch_at is not null
      and d.next_batch_at <= now() + interval '5 seconds'
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_resume_stopped_sr)
  ),
  'resume from STOPPED sets next_batch_at to now()'
);

-- 11) resume PAUSED -> ACTIVE sets next_batch_at to now()
create temp table _gate_resume_paused_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_resume_paused_sr),
  'DISPATCH_PAUSED'::public.service_request_dispatch_status,
  null,
  null
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_resume_paused_sr));

select ok(
  (
    select d.status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status
      and d.next_batch_at is not null
      and d.next_batch_at <= now() + interval '5 seconds'
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_resume_paused_sr)
  ),
  'resume from PAUSED sets next_batch_at to now()'
);

-- 12) resume STOPPED -> FALLBACK when fallback_opened_at is set
create temp table _gate_resume_fallback_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch(
  (select service_request_id from _gate_resume_fallback_sr),
  'DISPATCH_STOPPED'::public.service_request_dispatch_status,
  now(),
  null
);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_resume_fallback_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_resume_fallback_sr)
  ),
  'DISPATCH_FALLBACK_OPEN_MARKET',
  'resume ladder can land on FALLBACK when fallback_opened_at is set'
);

-- 13) no-op when service request is not OPEN
create temp table _gate_closed_sr as
select pg_temp.dispatch_gates_seed_sr() as service_request_id;

select pg_temp.dispatch_gates_seed_dispatch((select service_request_id from _gate_closed_sr));

update public.service_requests
set status = 'CANCELLED'::public.service_request_status
where id = (select service_request_id from _gate_closed_sr);

select pg_temp.dispatch_gates_seed_pending_proposals((select service_request_id from _gate_closed_sr), 2);

select public.evaluate_service_request_dispatch_gates((select service_request_id from _gate_closed_sr));

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _gate_closed_sr)
  ),
  'DISPATCH_ACTIVE',
  'gate evaluation no-op when service request is not OPEN'
);

select finish();

rollback;
