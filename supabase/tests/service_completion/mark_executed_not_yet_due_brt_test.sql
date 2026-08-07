-- pgTAP: Task 68 — SERVICE_NOT_YET_DUE / BRT today temporal gates (Req 11).
-- Uses service_completion_brt_today() as D; MUST NOT use payment_service_execution_at.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(7);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

-- Freeze D as BRT today for relative scheduling
create temp table _today as
select public.service_completion_brt_today() as d;

-- ---------------------------------------------------------------------------
-- BRT helpers — date-only America/Sao_Paulo (not payment clocks)
-- ---------------------------------------------------------------------------

select ok(
  pg_get_functiondef('public.service_completion_brt_today()'::regprocedure)
    ~ 'America/Sao_Paulo'
  and pg_get_functiondef('public.service_completion_brt_today()'::regprocedure)
    !~ 'payment_service_execution_at'
  and pg_get_functiondef('public.service_completion_scheduled_end_at(date,date)'::regprocedure)
    ~ 'America/Sao_Paulo'
  and pg_get_functiondef('public.service_completion_scheduled_end_at(date,date)'::regprocedure)
    !~ 'payment_service_execution_at',
  'BRT helpers use America/Sao_Paulo date-only; not payment_service_execution_at'
);

-- ---------------------------------------------------------------------------
-- Mark-executed fixtures: not-yet-due / on-time / past schedule / reschedule
-- ---------------------------------------------------------------------------

create temp table _fx as
select
  gen_random_uuid() as sr_future,
  gen_random_uuid() as prop_future,
  gen_random_uuid() as cs_future,
  gen_random_uuid() as enr_future,
  gen_random_uuid() as sr_ontime,
  gen_random_uuid() as prop_ontime,
  gen_random_uuid() as cs_ontime,
  gen_random_uuid() as enr_ontime,
  gen_random_uuid() as sr_past,
  gen_random_uuid() as prop_past,
  gen_random_uuid() as cs_past,
  gen_random_uuid() as enr_past,
  gen_random_uuid() as sr_resched,
  gen_random_uuid() as prop_resched,
  gen_random_uuid() as cs_resched,
  gen_random_uuid() as enr_resched,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('not_yet_due %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_future as sr_id, 'future' as label from _fx
  union all select sr_ontime, 'ontime' from _fx
  union all select sr_past, 'past' from _fx
  union all select sr_resched, 'resched' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_d date := (select d from _today);
  v_schema jsonb;
  v_slot_future jsonb;
  v_slot_today jsonb;
  v_slot_past jsonb;
begin
  v_slot_future := jsonb_build_object('start_date', to_char(v_d + 5, 'YYYY-MM-DD'), 'shift', 'morning');
  v_slot_today := jsonb_build_object('start_date', to_char(v_d, 'YYYY-MM-DD'), 'shift', 'morning');
  v_slot_past := jsonb_build_object('start_date', to_char(v_d - 10, 'YYYY-MM-DD'), 'shift', 'morning');

  select checklist_schema into v_schema
  from public.completion_checklist_templates
  where is_global and is_active
  limit 1;

  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('not_yet_due boundary %s', x.label),
    1, 'days', jsonb_build_array(x.slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_future as prop_id, sr_future as sr_id, 'future' as label, v_slot_future as slot from _fx
    union all select prop_ontime, sr_ontime, 'ontime', v_slot_today from _fx
    union all select prop_past, sr_past, 'past', v_slot_past from _fx
    union all select prop_resched, sr_resched, 'resched', v_slot_past from _fx
  ) x;

  -- Future start: CONFIRMED but not yet due
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_future, sr_future, prop_future, client_id, provider_id,
    'days', 1, v_d + 5, v_d + 5, 'morning', v_slot_future,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- On-time window (start = today)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_ontime, sr_ontime, prop_ontime, client_id, provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot_today,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- Past schedule: still allowed (no early gate once start date reached)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_past, sr_past, prop_past, client_id, provider_id,
    'days', 1, v_d - 10, v_d - 10, 'morning', v_slot_past,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- Reschedule fixture starts in the past; bump dates before mark
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_resched, sr_resched, prop_resched, client_id, provider_id,
    'days', 1, v_d - 10, v_d - 10, 'morning', v_slot_past,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select x.enr_id, x.sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from (
    select enr_future as enr_id, sr_future as sr_id from _fx
    union all select enr_ontime, sr_ontime from _fx
    union all select enr_past, sr_past from _fx
    union all select enr_resched, sr_resched from _fx
  ) x;

  -- Register evidence_paths used by mark-executed happy paths
  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id, status,
    storage_bucket, storage_prefix, expires_at
  )
  select
    gen_random_uuid(), x.cs_id, f.provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence',
    x.cs_id::text || '/not-yet-due/',
    now() + interval '1 hour'
  from _fx f
  cross join lateral (
    select cs_ontime as cs_id from _fx
    union all select cs_past from _fx
    union all select cs_resched from _fx
    union all select cs_future from _fx
  ) x;

  insert into public.completion_evidence_upload_objects (
    session_id, storage_path, byte_size
  )
  select s.id, s.contracted_service_id::text || '/evidence/photo.jpg', 512
  from public.completion_evidence_upload_sessions s
  join _fx f on s.contracted_service_id in (f.cs_ontime, f.cs_past, f.cs_resched, f.cs_future)
  where s.storage_prefix like '%/not-yet-due/';
end;
$seed$;

create or replace function pg_temp.mark_responses(p_cs uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'crit_work_done', jsonb_build_object(
      'met', true,
      'evidence_paths', jsonb_build_array(p_cs::text || '/evidence/photo.jpg')
    ),
    'crit_area_clean', jsonb_build_object('met', true),
    'crit_client_access', jsonb_build_object('met', true)
  );
$$;

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

-- D < scheduled_start_date → SERVICE_NOT_YET_DUE
select throws_ok(
  $sql$
    select public.service_completion_mark_executed(
      (select cs_future from _fx),
      pg_temp.mark_responses((select cs_future from _fx)),
      'idem-future',
      null
    )
  $sql$,
  'P0002',
  'SERVICE_NOT_YET_DUE',
  'D < scheduled_start_date → SERVICE_NOT_YET_DUE'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_future
  ),
  'CONFIRMED',
  'not-yet-due reject leaves CS CONFIRMED'
);

-- On-time (start = today) allowed
create temp table _mark_ontime as
select public.service_completion_mark_executed(
  (select cs_ontime from _fx),
  pg_temp.mark_responses((select cs_ontime from _fx)),
  'idem-ontime',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _mark_ontime)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_ontime
    where cs.status = 'EXECUTED'::public.contracted_service_status
  )
  and exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ontime
    where e.phase = 'frozen'::public.completion_evidence_phase
  ),
  'on-time (D = start) mark-executed succeeds and freezes evidence'
);

-- Past schedule still allowed once start date has passed
create temp table _mark_past as
select public.service_completion_mark_executed(
  (select cs_past from _fx),
  pg_temp.mark_responses((select cs_past from _fx)),
  'idem-past',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _mark_past)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_past
    where cs.status = 'EXECUTED'::public.contracted_service_status
  ),
  'past schedule mark-executed still allowed (no late flag)'
);

-- Reschedule dates honored: bump past CS into on-time window before mark
update public.contracted_services cs
set
  scheduled_start_date = (select d from _today),
  scheduled_end_date = (select d from _today),
  agreed_slot = jsonb_build_object(
    'start_date', to_char((select d from _today), 'YYYY-MM-DD'),
    'shift', 'morning'
  )
from _fx f
where cs.id = f.cs_resched;

create temp table _mark_resched as
select public.service_completion_mark_executed(
  (select cs_resched from _fx),
  pg_temp.mark_responses((select cs_resched from _fx)),
  'idem-resched',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _mark_resched)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_resched
    where cs.status = 'EXECUTED'::public.contracted_service_status
  ),
  'after reschedule to today, mark-executed succeeds'
);

-- mark_executed still uses BRT today for SERVICE_NOT_YET_DUE
select ok(
  pg_get_functiondef(
    'public.service_completion_mark_executed(uuid,jsonb,text,integer)'::regprocedure
  ) ~ 'SERVICE_NOT_YET_DUE'
  and pg_get_functiondef(
    'public.service_completion_mark_executed(uuid,jsonb,text,integer)'::regprocedure
  ) ~ 'service_completion_brt_today',
  'mark_executed gates SERVICE_NOT_YET_DUE via service_completion_brt_today'
);

select * from finish();

rollback;
