-- pgTAP: get_client_service_journey — ownership, happy path, gap-fill, payment,
-- CONFIRMED, cancel truncate, dispute, optional rating after COMPLETED.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(37);

select set_config('rls.client_id', gen_random_uuid()::text, true);
select set_config('rls.other_client_id', gen_random_uuid()::text, true);
select set_config('rls.provider_id', gen_random_uuid()::text, true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(
  current_setting('rls.client_id')::uuid, 'client', 'Journey client'
);
select pg_temp.rls_seed_user(
  current_setting('rls.other_client_id')::uuid, 'client', 'Journey other client'
);
select pg_temp.rls_seed_user(
  current_setting('rls.provider_id')::uuid, 'provider', 'Journey provider'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function pg_temp.journey_milestone_status(
  p_payload jsonb,
  p_key text
)
returns text
language sql
stable
as $$
  select m->>'status'
  from jsonb_array_elements(p_payload->'milestones') m
  where m->>'key' = p_key
  limit 1;
$$;

create or replace function pg_temp.journey_milestone_at(
  p_payload jsonb,
  p_key text
)
returns timestamptz
language sql
stable
as $$
  select (m->>'occurred_at')::timestamptz
  from jsonb_array_elements(p_payload->'milestones') m
  where m->>'key' = p_key
  limit 1;
$$;

create or replace function pg_temp.journey_has_key(
  p_payload jsonb,
  p_key text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jsonb_array_elements(p_payload->'milestones') m
    where m->>'key' = p_key
  );
$$;

create or replace function pg_temp.journey_seed_sr(
  p_sr_id uuid,
  p_title text,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency, created_at, updated_at
  )
  select
    p_sr_id,
    current_setting('rls.client_id')::uuid,
    sr.service_id,
    sr.address_id,
    p_title,
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency,
    p_created_at,
    p_created_at
  from public.service_requests sr
  where sr.id = current_setting('rls.template_sr')::uuid;
end;
$$;

create or replace function pg_temp.journey_seed_proposal(
  p_prop_id uuid,
  p_sr_id uuid,
  p_submitted_at timestamptz,
  p_status public.proposal_status default 'PENDING'::public.proposal_status
)
returns void
language plpgsql
as $$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 2, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  perform pg_temp.rls_set_jwt(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status,
    created_at, submitted_at
  )
  values (
    p_prop_id,
    current_setting('rls.provider_id')::uuid,
    p_sr_id,
    v_pricing.original_amount,
    'journey proposal',
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[],
    v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature,
    p_status,
    p_submitted_at,
    p_submitted_at
  );

  reset role;
end;
$$;

create or replace function pg_temp.journey_seed_cs(
  p_cs_id uuid,
  p_sr_id uuid,
  p_prop_id uuid,
  p_status public.contracted_service_status,
  p_created_at timestamptz,
  p_executed_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_completed_by text default null
)
returns void
language plpgsql
as $$
declare
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 2, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, created_at, updated_at, executed_at, completed_at, completed_by
  )
  values (
    p_cs_id,
    p_sr_id,
    p_prop_id,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_id')::uuid,
    'days', 1,
    current_date + 2, current_date + 2, 'morning',
    v_slot,
    p_status,
    p_created_at,
    p_created_at,
    p_executed_at,
    p_completed_at,
    p_completed_by
  );

  update public.service_requests
  set contracted_service_id = p_cs_id
  where id = p_sr_id;
end;
$$;

create or replace function pg_temp.journey_seed_schedule(
  p_cs_id uuid,
  p_state public.payment_schedule_state,
  p_paid_at timestamptz default null
)
returns void
language plpgsql
as $$
begin
  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at, state,
    idempotency_key, gateway_reference_code, paid_at, paid_amount, gateway_transaction_id
  )
  values (
    p_cs_id,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_id')::uuid,
    1,
    100.00, 15.00, 85.00,
    coalesce(p_paid_at, now()),
    p_state,
    p_cs_id::text,
    p_cs_id,
    p_paid_at,
    case when p_paid_at is not null then 100.00 else null end,
    case when p_paid_at is not null then 'txn-' || p_cs_id::text else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Existence + grants
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_client_service_journey'
      and pg_get_function_identity_arguments(p.oid) = 'p_service_request_id uuid'
  ),
  'get_client_service_journey(uuid) exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_client_service_journey(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute get_client_service_journey'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_client_service_journey(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute get_client_service_journey'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.get_client_service_journey(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service_role cannot execute get_client_service_journey'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

create temp table _fx as
select
  gen_random_uuid() as sr_open,
  gen_random_uuid() as sr_gap,
  gen_random_uuid() as prop_gap,
  gen_random_uuid() as sr_pending,
  gen_random_uuid() as prop_pending,
  gen_random_uuid() as cs_pending,
  gen_random_uuid() as sr_confirmed,
  gen_random_uuid() as prop_confirmed,
  gen_random_uuid() as cs_confirmed,
  gen_random_uuid() as sr_happy,
  gen_random_uuid() as prop_happy,
  gen_random_uuid() as cs_happy,
  gen_random_uuid() as chat_happy,
  gen_random_uuid() as sr_cancel,
  gen_random_uuid() as prop_cancel,
  gen_random_uuid() as chat_cancel,
  gen_random_uuid() as sr_dispute,
  gen_random_uuid() as prop_dispute,
  gen_random_uuid() as cs_dispute,
  gen_random_uuid() as chat_dispute,
  gen_random_uuid() as sr_rating,
  gen_random_uuid() as prop_rating,
  gen_random_uuid() as cs_rating,
  gen_random_uuid() as chat_rating,
  timestamptz '2026-03-01 10:00:00+00' as t_created,
  timestamptz '2026-03-01 11:00:00+00' as t_chat,
  timestamptz '2026-03-01 12:00:00+00' as t_proposal,
  timestamptz '2026-03-01 13:00:00+00' as t_cs,
  timestamptz '2026-03-01 14:00:00+00' as t_paid,
  timestamptz '2026-03-02 15:00:00+00' as t_executed,
  timestamptz '2026-03-03 16:00:00+00' as t_completed,
  timestamptz '2026-03-03 17:00:00+00' as t_rated,
  timestamptz '2026-03-04 18:00:00+00' as t_cancelled;

-- OPEN owner baseline
select pg_temp.journey_seed_sr(
  (select sr_open from _fx),
  'journey open',
  (select t_created from _fx)
);

-- Gap-fill: proposal without chat
select pg_temp.journey_seed_sr(
  (select sr_gap from _fx),
  'journey gap',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_gap from _fx),
  (select sr_gap from _fx),
  (select t_proposal from _fx)
);

-- PENDING_PAYMENT
select pg_temp.journey_seed_sr(
  (select sr_pending from _fx),
  'journey pending payment',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_pending from _fx),
  (select sr_pending from _fx),
  (select t_proposal from _fx),
  'ACCEPTED'::public.proposal_status
);
select pg_temp.journey_seed_cs(
  (select cs_pending from _fx),
  (select sr_pending from _fx),
  (select prop_pending from _fx),
  'PENDING_PAYMENT'::public.contracted_service_status,
  (select t_cs from _fx)
);
select pg_temp.journey_seed_schedule(
  (select cs_pending from _fx),
  'SCHEDULED'::public.payment_schedule_state,
  null
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  gen_random_uuid(), sr_pending,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

-- CONFIRMED (payment + scheduled completed)
select pg_temp.journey_seed_sr(
  (select sr_confirmed from _fx),
  'journey confirmed',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_confirmed from _fx),
  (select sr_confirmed from _fx),
  (select t_proposal from _fx),
  'ACCEPTED'::public.proposal_status
);
select pg_temp.journey_seed_cs(
  (select cs_confirmed from _fx),
  (select sr_confirmed from _fx),
  (select prop_confirmed from _fx),
  'CONFIRMED'::public.contracted_service_status,
  (select t_cs from _fx)
);
select pg_temp.journey_seed_schedule(
  (select cs_confirmed from _fx),
  'PAID'::public.payment_schedule_state,
  (select t_paid from _fx)
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  gen_random_uuid(), sr_confirmed,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

-- Happy path COMPLETED + rating
select pg_temp.journey_seed_sr(
  (select sr_happy from _fx),
  'journey happy',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_happy from _fx),
  (select sr_happy from _fx),
  (select t_proposal from _fx),
  'ACCEPTED'::public.proposal_status
);
select pg_temp.journey_seed_cs(
  (select cs_happy from _fx),
  (select sr_happy from _fx),
  (select prop_happy from _fx),
  'COMPLETED'::public.contracted_service_status,
  (select t_cs from _fx),
  (select t_executed from _fx),
  (select t_completed from _fx),
  'client'
);
select pg_temp.journey_seed_schedule(
  (select cs_happy from _fx),
  'PAID'::public.payment_schedule_state,
  (select t_paid from _fx)
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  chat_happy, sr_happy,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

insert into public.service_ratings (
  contracted_service_id, service_request_id, client_id, provider_id,
  score_quality, score_punctuality, score_communication, score_value,
  overall_score, comment, submitted_at
)
select
  cs_happy, sr_happy,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  5, 5, 5, 5, 5.0, 'great', t_rated
from _fx;

-- Cancel after proposal (no CS): truncate futures + terminal cancelled
select pg_temp.journey_seed_sr(
  (select sr_cancel from _fx),
  'journey cancel',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_cancel from _fx),
  (select sr_cancel from _fx),
  (select t_proposal from _fx)
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  chat_cancel, sr_cancel,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

update public.service_requests
set
  status = 'CANCELLED'::public.service_request_status,
  cancelled_at = (select t_cancelled from _fx),
  updated_at = (select t_cancelled from _fx)
where id = (select sr_cancel from _fx);

-- Dispute after EXECUTED
select pg_temp.journey_seed_sr(
  (select sr_dispute from _fx),
  'journey dispute',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_dispute from _fx),
  (select sr_dispute from _fx),
  (select t_proposal from _fx),
  'ACCEPTED'::public.proposal_status
);
select pg_temp.journey_seed_cs(
  (select cs_dispute from _fx),
  (select sr_dispute from _fx),
  (select prop_dispute from _fx),
  'IN_DISPUTE'::public.contracted_service_status,
  (select t_cs from _fx),
  (select t_executed from _fx)
);
select pg_temp.journey_seed_schedule(
  (select cs_dispute from _fx),
  'PAID'::public.payment_schedule_state,
  (select t_paid from _fx)
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  chat_dispute, sr_dispute,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

update public.contracted_services
set
  updated_at = (select t_completed from _fx),
  disputed_at = (select t_completed from _fx),
  disputed_by = current_setting('rls.client_id')::uuid,
  dispute_reason = 'quality'
where id = (select cs_dispute from _fx);

-- COMPLETED without rating → rating stays current
select pg_temp.journey_seed_sr(
  (select sr_rating from _fx),
  'journey optional rating',
  (select t_created from _fx)
);
select pg_temp.journey_seed_proposal(
  (select prop_rating from _fx),
  (select sr_rating from _fx),
  (select t_proposal from _fx),
  'ACCEPTED'::public.proposal_status
);
select pg_temp.journey_seed_cs(
  (select cs_rating from _fx),
  (select sr_rating from _fx),
  (select prop_rating from _fx),
  'COMPLETED'::public.contracted_service_status,
  (select t_cs from _fx),
  (select t_executed from _fx),
  (select t_completed from _fx),
  'system'
);
select pg_temp.journey_seed_schedule(
  (select cs_rating from _fx),
  'PAID'::public.payment_schedule_state,
  (select t_paid from _fx)
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
select
  chat_rating, sr_rating,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  t_chat, t_chat
from _fx;

-- ---------------------------------------------------------------------------
-- Auth + ownership
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_anon();

select throws_ok(
  format(
    $sql$ select public.get_client_service_journey('%s'::uuid) $sql$,
    (select sr_open from _fx)
  ),
  '42501',
  'Authentication required for get_client_service_journey',
  'unauthenticated call raises 42501'
);

select pg_temp.rls_set_auth(current_setting('rls.other_client_id')::uuid);

select throws_ok(
  format(
    $sql$ select public.get_client_service_journey('%s'::uuid) $sql$,
    (select sr_open from _fx)
  ),
  '42501',
  'Service not found or access denied',
  'non-owner cannot read client service journey'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _open as
select public.get_client_service_journey((select sr_open from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _open), 'request_created'),
  'completed',
  'owner OPEN: request_created completed'
);

select is(
  pg_temp.journey_milestone_status((select payload from _open), 'professionals_interested'),
  'current',
  'owner OPEN: professionals_interested is current'
);

select is(
  pg_temp.journey_milestone_at((select payload from _open), 'request_created'),
  (select t_created from _fx),
  'owner OPEN: request_created occurred_at matches SR.created_at'
);

-- ---------------------------------------------------------------------------
-- Gap-fill: missing chat inherits proposal timestamp
-- ---------------------------------------------------------------------------

create temp table _gap as
select public.get_client_service_journey((select sr_gap from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _gap), 'professionals_interested'),
  'completed',
  'gap-fill: professionals_interested completed without chat'
);

select is(
  pg_temp.journey_milestone_at((select payload from _gap), 'professionals_interested'),
  (select t_proposal from _fx),
  'gap-fill: professionals_interested inherits quote_received timestamp'
);

select is(
  pg_temp.journey_milestone_status((select payload from _gap), 'quote_received'),
  'completed',
  'gap-fill: quote_received completed'
);

select is(
  pg_temp.journey_milestone_status((select payload from _gap), 'quote_approved'),
  'current',
  'gap-fill: quote_approved is current when no CS'
);

-- ---------------------------------------------------------------------------
-- PENDING_PAYMENT → payment current; scheduled not completed
-- ---------------------------------------------------------------------------

create temp table _pending as
select public.get_client_service_journey((select sr_pending from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _pending), 'quote_approved'),
  'completed',
  'pending payment: quote_approved completed'
);

select is(
  pg_temp.journey_milestone_status((select payload from _pending), 'payment'),
  'current',
  'pending payment: payment is current'
);

select is(
  pg_temp.journey_milestone_status((select payload from _pending), 'service_scheduled'),
  'upcoming',
  'pending payment: service_scheduled remains upcoming'
);

-- ---------------------------------------------------------------------------
-- CONFIRMED → payment + service_scheduled completed
-- ---------------------------------------------------------------------------

create temp table _confirmed as
select public.get_client_service_journey((select sr_confirmed from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _confirmed), 'payment'),
  'completed',
  'CONFIRMED: payment completed'
);

select is(
  pg_temp.journey_milestone_at((select payload from _confirmed), 'payment'),
  (select t_paid from _fx),
  'CONFIRMED: payment occurred_at is paid_at'
);

select is(
  pg_temp.journey_milestone_status((select payload from _confirmed), 'service_scheduled'),
  'completed',
  'CONFIRMED: service_scheduled completed'
);

select is(
  pg_temp.journey_milestone_status((select payload from _confirmed), 'service_executed'),
  'current',
  'CONFIRMED: service_executed is current'
);

-- ---------------------------------------------------------------------------
-- Happy path timestamps through rating
-- ---------------------------------------------------------------------------

create temp table _happy as
select public.get_client_service_journey((select sr_happy from _fx)) as payload;

select is(
  (
    select jsonb_agg(m->>'key' order by ordinality)
    from jsonb_array_elements((select payload from _happy)->'milestones')
      with ordinality as t(m, ordinality)
  ),
  '["request_created","professionals_interested","quote_received","quote_approved","payment","service_scheduled","service_executed","rating"]'::jsonb,
  'happy path: eight canonical milestone keys in order'
);

select ok(
  (
    select bool_and(m->>'status' = 'completed')
    from jsonb_array_elements((select payload from _happy)->'milestones') m
  ),
  'happy path: all milestones completed when rated'
);

select is(
  pg_temp.journey_milestone_at((select payload from _happy), 'professionals_interested'),
  (select t_chat from _fx),
  'happy path: professionals_interested occurred_at is min(chat.created_at)'
);

select is(
  pg_temp.journey_milestone_at((select payload from _happy), 'service_executed'),
  (select t_executed from _fx),
  'happy path: service_executed occurred_at is executed_at'
);

select is(
  pg_temp.journey_milestone_at((select payload from _happy), 'rating'),
  (select t_rated from _fx),
  'happy path: rating occurred_at is submitted_at'
);

-- ---------------------------------------------------------------------------
-- Cancel truncates futures + terminal cancelled
-- ---------------------------------------------------------------------------

create temp table _cancel as
select public.get_client_service_journey((select sr_cancel from _fx)) as payload;

select ok(
  pg_temp.journey_has_key((select payload from _cancel), 'cancelled'),
  'cancel: terminal cancelled node present'
);

select is(
  pg_temp.journey_milestone_status((select payload from _cancel), 'cancelled'),
  'current',
  'cancel: cancelled is current'
);

select ok(
  not pg_temp.journey_has_key((select payload from _cancel), 'quote_approved')
  and not pg_temp.journey_has_key((select payload from _cancel), 'payment')
  and not pg_temp.journey_has_key((select payload from _cancel), 'rating'),
  'cancel: incomplete futures truncated'
);

select is(
  pg_temp.journey_milestone_status((select payload from _cancel), 'quote_received'),
  'completed',
  'cancel: prior completed milestones preserved'
);

select is(
  pg_temp.journey_milestone_at((select payload from _cancel), 'cancelled'),
  (select t_cancelled from _fx),
  'cancel: cancelled occurred_at is cancelled_at'
);

-- ---------------------------------------------------------------------------
-- Dispute truncates rating + terminal in_dispute
-- ---------------------------------------------------------------------------

create temp table _dispute as
select public.get_client_service_journey((select sr_dispute from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _dispute), 'in_dispute'),
  'current',
  'dispute: in_dispute is current'
);

select ok(
  not pg_temp.journey_has_key((select payload from _dispute), 'rating')
  and not pg_temp.journey_has_key((select payload from _dispute), 'cancelled'),
  'dispute: rating diverted and cancelled absent'
);

select is(
  pg_temp.journey_milestone_status((select payload from _dispute), 'service_executed'),
  'completed',
  'dispute: service_executed remains completed'
);

-- ---------------------------------------------------------------------------
-- Optional rating after COMPLETED (no rating row)
-- ---------------------------------------------------------------------------

create temp table _rating as
select public.get_client_service_journey((select sr_rating from _fx)) as payload;

select is(
  pg_temp.journey_milestone_status((select payload from _rating), 'service_executed'),
  'completed',
  'optional rating: service_executed completed'
);

select is(
  pg_temp.journey_milestone_status((select payload from _rating), 'rating'),
  'current',
  'optional rating: rating stays current after COMPLETED without rating'
);

-- ---------------------------------------------------------------------------
-- Chronology: proposal older than SR is clamped / non-decreasing
-- ---------------------------------------------------------------------------

select set_config('rls.sr_chrono', gen_random_uuid()::text, true);
select set_config('rls.prop_chrono', gen_random_uuid()::text, true);
select set_config('rls.chat_chrono', gen_random_uuid()::text, true);

select pg_temp.journey_seed_sr(
  current_setting('rls.sr_chrono')::uuid,
  'Chronology clamp SR',
  timestamptz '2026-08-10 21:42:00+00'
);

-- Stale proposal before request creation must not appear earlier on the timeline.
select pg_temp.journey_seed_proposal(
  current_setting('rls.prop_chrono')::uuid,
  current_setting('rls.sr_chrono')::uuid,
  timestamptz '2026-06-09 20:01:00+00'
);

insert into public.chats (
  id, service_request_id, client_id, provider_id, status, last_interaction_at, created_at
)
values (
  current_setting('rls.chat_chrono')::uuid,
  current_setting('rls.sr_chrono')::uuid,
  current_setting('rls.client_id')::uuid,
  current_setting('rls.provider_id')::uuid,
  'ACTIVE'::public.cns_conversation_status,
  timestamptz '2026-08-10 21:42:00+00',
  timestamptz '2026-08-10 21:42:00+00'
);

select pg_temp.rls_set_jwt(current_setting('rls.client_id')::uuid);

create temp table _chrono as
select public.get_client_service_journey(
  current_setting('rls.sr_chrono')::uuid
) as payload;

select is(
  pg_temp.journey_milestone_at((select payload from _chrono), 'quote_received'),
  timestamptz '2026-08-10 21:42:00+00',
  'chronology: quote_received clamped to >= request_created'
);

select ok(
  (
    select
      pg_temp.journey_milestone_at((select payload from _chrono), 'request_created')
        <= pg_temp.journey_milestone_at((select payload from _chrono), 'professionals_interested')
      and pg_temp.journey_milestone_at((select payload from _chrono), 'professionals_interested')
        <= pg_temp.journey_milestone_at((select payload from _chrono), 'quote_received')
  ),
  'chronology: completed occurred_at is non-decreasing'
);

select * from finish();
rollback;
