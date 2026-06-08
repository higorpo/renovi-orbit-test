-- pgTAP: expire_pending_proposals (CNS task 39, design §4.7).

begin;

\ir fixtures/seed_chat.inc
\ir fixtures/seed_reciprocity_messages.inc

select plan(12);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'expire_pending_proposals'
  ),
  'expire_pending_proposals is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.expire_pending_proposals(int)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.expire_pending_proposals(int)',
    'EXECUTE'
  ),
  'service_role only may execute expiry batch RPC'
);

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

create or replace function pg_temp.cns_seed_expiry_sr()
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
    'Proposal expiry pgTAP fixture',
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

create or replace function pg_temp.cns_seed_stale_pending_proposal(
  p_service_request_id uuid,
  p_with_recent_activity boolean default false
)
returns table (
  result_chat_id uuid,
  result_proposal_id uuid
)
language plpgsql
as $$
declare
  v_chat_id uuid;
  v_proposal_id uuid;
  v_response jsonb;
begin
  v_chat_id := pg_temp.cns_seed_chat(
    p_service_request_id := p_service_request_id,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    p_status := 'ACTIVE'::public.cns_conversation_status,
    p_last_interaction_at := now() - interval '30 hours'
  );

  perform pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

  with pricing as (
    select *
    from public.calculate_provider_service_pricing(250.00::numeric)
  )
  select public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    pricing.original_amount,
    'Stale proposal fixture',
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
  )
  into v_response
  from pricing;

  v_proposal_id := (v_response->'proposal'->>'id')::uuid;

  update public.provider_proposals
  set submitted_at = now() - interval '25 hours'
  where id = v_proposal_id;

  update public.chat_messages
  set created_at = now() - interval '30 hours'
  where chat_id = v_chat_id;

  if p_with_recent_activity then
    perform pg_temp.cns_seed_reciprocity_message(
      v_chat_id,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'TEXT'::public.cns_message_type,
      now() - interval '2 hours'
    );
  end if;

  result_chat_id := v_chat_id;
  result_proposal_id := v_proposal_id;
  return next;
end;
$$;

-- R9-AC01: stale PENDING → EXPIRED with expired_at.
create temp table _expiry_case as
select *
from pg_temp.cns_seed_stale_pending_proposal(
  pg_temp.cns_seed_expiry_sr(),
  false
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  not public.cns_chat_free_messaging_allowed((select result_chat_id from _expiry_case)),
  'free messaging blocked while proposal is PENDING'
);

select public.expire_pending_proposals(500);

select is(
  (select status::text from public.provider_proposals where id = (select result_proposal_id from _expiry_case)),
  'EXPIRED',
  'stale PENDING proposal transitions to EXPIRED (R9-AC01)'
);

select ok(
  (select expired_at is not null from public.provider_proposals where id = (select result_proposal_id from _expiry_case)),
  'expired_at is set on expiry'
);

select ok(
  (
    select exists (
      select 1
      from message_dispatcher.message_dispatches d
      where d.template_key = 'proposal.expired'
        and d.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
        and d.metadata->>'proposal_id' = (select result_proposal_id::text from _expiry_case)
    )
    and not exists (
      select 1
      from public.domain_events de
      where de.event_type in ('PROPOSAL_EXPIRED', 'CONVERSATION_INACTIVATED', 'SLOT_RELEASED')
        and (
          de.aggregate_id = (select result_proposal_id from _expiry_case)
          or de.chat_id = (select result_chat_id from _expiry_case)
        )
    )
  ),
  'expiry enqueues proposal.expired via trigger without migrated domain_events'
);

-- R9-AC03: free messaging restored after expiry when chat is not CLOSED.
select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  public.cns_chat_free_messaging_allowed((select result_chat_id from _expiry_case)),
  'free messaging re-enabled after proposal expiry (R9-AC03)'
);

-- R9-AC05: no recent activity → optional INACTIVE.
select is(
  (select status::text from public.chats where id = (select result_chat_id from _expiry_case)),
  'INACTIVE',
  'chat without recent activity becomes INACTIVE after expiry (R9-AC05)'
);

-- R9-AC04: recent activity keeps chat ACTIVE.
create temp table _active_after_expiry_case as
select *
from pg_temp.cns_seed_stale_pending_proposal(
  pg_temp.cns_seed_expiry_sr(),
  true
);

select public.expire_pending_proposals(500);

select is(
  (select status::text from public.chats where id = (select result_chat_id from _active_after_expiry_case)),
  'ACTIVE',
  'chat with recent message activity stays ACTIVE after expiry (R9-AC04)'
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  public.cns_chat_free_messaging_allowed((select result_chat_id from _active_after_expiry_case)),
  'free messaging restored on active chat after expiry'
);

select ok(
  (
    select finished_at is not null
      and processed_count >= 1
      and transitioned_count >= 1
      and duration_ms is not null
      and (metadata->>'max_lag_seconds') is not null
    from public.job_runs
    where job_name = 'proposal_expire_pending'
    order by id desc
    limit 1
  ),
  'records job_runs metrics and expiry lag metadata'
);

-- R25-AC02: conditional UPDATE WHERE status = PENDING (idempotent second pass).
select is(
  (select (public.expire_pending_proposals(500)->>'expired_count')::int),
  0,
  'second batch pass does not re-expire already EXPIRED proposals (R25-AC02)'
);

select finish();

rollback;
