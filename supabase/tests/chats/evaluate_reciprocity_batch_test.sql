-- pgTAP: cns_evaluate_reciprocity_batch (CNS task 38, design §4.6).

begin;

\ir fixtures/seed_chat.inc
\ir fixtures/seed_reciprocity_messages.inc

select plan(9);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_evaluate_reciprocity_batch'
  ),
  'cns_evaluate_reciprocity_batch is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_evaluate_reciprocity_batch(int)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cns_evaluate_reciprocity_batch(int)',
    'EXECUTE'
  ),
  'service_role only may execute batch RPC'
);

create or replace function pg_temp.cns_seed_reciprocity_batch_sr(
  p_status public.service_request_status default 'OPEN'
)
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
    'Reciprocity batch pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    p_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.cns_seed_stale_active_chat(
  p_service_request_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_client_id uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_chat_id uuid;
begin
  v_chat_id := pg_temp.cns_seed_chat(
    p_service_request_id := p_service_request_id,
    p_client_id := v_client_id,
    p_provider_id := v_provider_id,
    p_status := 'ACTIVE'::public.cns_conversation_status,
    p_last_interaction_at := now() - interval '25 hours'
  );

  insert into public.service_request_negotiation_stats (
    service_request_id,
    active_chat_count
  )
  values (p_service_request_id, 1)
  on conflict (service_request_id) do update
    set active_chat_count = 1;

  return v_chat_id;
end;
$$;

-- Unilateral stale chat → INACTIVE, slot -1, domain events (R4-AC02, R4-AC04).
create temp table _unilateral_case as
with sr as (
  select pg_temp.cns_seed_reciprocity_batch_sr() as sr_id
)
select
  sr.sr_id,
  pg_temp.cns_seed_stale_active_chat(sr.sr_id) as chat_id
from sr;

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _unilateral_case),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select public.cns_evaluate_reciprocity_batch(500);

select is(
  (select status::text from public.chats where id = (select chat_id from _unilateral_case)),
  'INACTIVE',
  'unilateral stale chat transitions to INACTIVE'
);

select is(
  (
    select inactivation_reason::text
    from public.chats
    where id = (select chat_id from _unilateral_case)
  ),
  'NO_RECIPROCITY',
  'sets NO_RECIPROCITY inactivation reason'
);

select is(
  (
    select active_chat_count
    from public.service_request_negotiation_stats
    where service_request_id = (select sr_id from _unilateral_case)
  ),
  0,
  'decrements active_chat_count by one'
);

select ok(
  not exists (
    select 1
    from public.domain_events de
    where de.chat_id = (select chat_id from _unilateral_case)
      and de.event_type in ('CONVERSATION_INACTIVATED', 'SLOT_RELEASED')
  ),
  'does not emit CONVERSATION_INACTIVATED or SLOT_RELEASED domain_events'
);

-- Bilateral stale chat stays ACTIVE (R4-AC03).
create temp table _bilateral_case as
with sr as (
  select pg_temp.cns_seed_reciprocity_batch_sr() as sr_id
)
select
  sr.sr_id,
  pg_temp.cns_seed_stale_active_chat(sr.sr_id) as chat_id
from sr;

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _bilateral_case),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '23 hours'
);

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _bilateral_case),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '23 hours'
);

select public.cns_evaluate_reciprocity_batch(500);

select is(
  (select status::text from public.chats where id = (select chat_id from _bilateral_case)),
  'ACTIVE',
  'bilateral stale chat remains ACTIVE'
);

-- Terminal SR skipped (R25-AC07).
create temp table _completed_sr_case as
with sr as (
  select pg_temp.cns_seed_reciprocity_batch_sr('COMPLETED'::public.service_request_status) as sr_id
)
select
  sr.sr_id,
  pg_temp.cns_seed_stale_active_chat(sr.sr_id) as chat_id
from sr;

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _completed_sr_case),
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select public.cns_evaluate_reciprocity_batch(500);

select is(
  (select status::text from public.chats where id = (select chat_id from _completed_sr_case)),
  'ACTIVE',
  'skips reciprocity for COMPLETED service request'
);

select ok(
  (
    select exists (
      select 1
      from public.job_runs jr
      where jr.job_name = 'chat_evaluate_reciprocity'
        and jr.finished_at is not null
        and jr.processed_count >= 1
        and jr.duration_ms is not null
    )
  ),
  'records job_runs metrics on completion'
);

select finish();

rollback;
