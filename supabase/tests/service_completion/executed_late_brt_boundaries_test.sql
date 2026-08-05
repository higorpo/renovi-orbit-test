-- pgTAP: Task 68 — executed_late BRT boundaries + SERVICE_NOT_YET_DUE (Req 11).
-- Uses service_completion_brt_today() as D; MUST NOT use payment_service_execution_at.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(12);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

-- Freeze D as BRT today for relative scheduling
create temp table _today as
select public.service_completion_brt_today() as d;

-- ---------------------------------------------------------------------------
-- Helper boundaries (scalar overload) — Req 11 AC1, AC3, AC4
-- ---------------------------------------------------------------------------

select ok(
  pg_get_functiondef('public.service_completion_compute_executed_late(date,date)'::regprocedure)
    !~ 'payment_service_execution_at'
  and pg_get_functiondef('public.service_completion_brt_today()'::regprocedure)
    ~ 'America/Sao_Paulo',
  '11.6 helpers use America/Sao_Paulo date-only; not payment_service_execution_at'
);

select is(
  public.service_completion_compute_executed_late(
    (select d from _today),
    (select d from _today)
  ),
  false,
  '11.3 on-time: D = start = end → executed_late false'
);

select is(
  public.service_completion_compute_executed_late(
    (select d - 2 from _today),
    (select d - 1 from _today)
  ),
  false,
  '11.3 on-time ceiling: D = effective_end + 1 → executed_late false'
);

select is(
  public.service_completion_compute_executed_late(
    (select d - 10 from _today),
    (select d - 3 from _today)
  ),
  true,
  '11.4 late: D > effective_end + 1 → executed_late true'
);

select is(
  public.service_completion_compute_executed_late(
    (select d from _today),
    null
  ),
  false,
  '11.1 coalesce(end, start): null end uses start; D = start → not late'
);

-- ---------------------------------------------------------------------------
-- Mark-executed fixtures: not-yet-due / on-time / late / reschedule
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
  gen_random_uuid() as sr_late,
  gen_random_uuid() as prop_late,
  gen_random_uuid() as cs_late,
  gen_random_uuid() as enr_late,
  gen_random_uuid() as sr_resched,
  gen_random_uuid() as prop_resched,
  gen_random_uuid() as cs_resched,
  gen_random_uuid() as enr_resched,
  gen_random_uuid() as sr_auto,
  gen_random_uuid() as prop_auto,
  gen_random_uuid() as cs_auto,
  gen_random_uuid() as enr_auto,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('executed_late %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_future as sr_id, 'future' as label from _fx
  union all select sr_ontime, 'ontime' from _fx
  union all select sr_late, 'late' from _fx
  union all select sr_resched, 'resched' from _fx
  union all select sr_auto, 'auto' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_d date := (select d from _today);
  v_schema jsonb;
  v_slot_future jsonb;
  v_slot_today jsonb;
  v_slot_late jsonb;
begin
  v_slot_future := jsonb_build_object('start_date', to_char(v_d + 5, 'YYYY-MM-DD'), 'shift', 'morning');
  v_slot_today := jsonb_build_object('start_date', to_char(v_d, 'YYYY-MM-DD'), 'shift', 'morning');
  v_slot_late := jsonb_build_object('start_date', to_char(v_d - 10, 'YYYY-MM-DD'), 'shift', 'morning');

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
    format('late boundary %s', x.label),
    1, 'days', jsonb_build_array(x.slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_future as prop_id, sr_future as sr_id, 'future' as label, v_slot_future as slot from _fx
    union all select prop_ontime, sr_ontime, 'ontime', v_slot_today from _fx
    union all select prop_late, sr_late, 'late', v_slot_late from _fx
    union all select prop_resched, sr_resched, 'resched', v_slot_late from _fx
    union all select prop_auto, sr_auto, 'auto', v_slot_late from _fx
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

  -- On-time window
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

  -- Late window (still allowed): duration_value=1 ⇒ start=end
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_late, sr_late, prop_late, client_id, provider_id,
    'days', 1, v_d - 10, v_d - 10, 'morning', v_slot_late,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- Reschedule fixture starts late; we'll bump dates before mark
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs_resched, sr_resched, prop_resched, client_id, provider_id,
    'days', 1, v_d - 10, v_d - 10, 'morning', v_slot_late,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- Auto-complete preserve: already EXECUTED + frozen late
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    cs_auto, sr_auto, prop_auto, client_id, provider_id,
    'days', 1, v_d - 10, v_d - 10, 'morning', v_slot_late,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '48 hours'
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
    union all select enr_late, sr_late from _fx
    union all select enr_resched, sr_resched from _fx
    union all select enr_auto, sr_auto from _fx
  ) x;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    executed_late, responses, idempotency_key
  )
  select
    cs_auto, enr_auto,
    'frozen'::public.completion_evidence_phase,
    now() - interval '48 hours',
    'late-hash',
    true,
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-auto-late'
  from _fx;

  -- Register evidence_paths used by mark-executed happy paths
  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id, status,
    storage_bucket, storage_prefix, expires_at
  )
  select
    gen_random_uuid(), x.cs_id, f.provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence',
    x.cs_id::text || '/late-bound/',
    now() + interval '1 hour'
  from _fx f
  cross join lateral (
    select cs_ontime as cs_id from _fx
    union all select cs_late from _fx
    union all select cs_resched from _fx
    union all select cs_future from _fx
  ) x;

  insert into public.completion_evidence_upload_objects (
    session_id, storage_path, byte_size
  )
  select s.id, s.contracted_service_id::text || '/evidence/photo.jpg', 512
  from public.completion_evidence_upload_sessions s
  join _fx f on s.contracted_service_id in (f.cs_ontime, f.cs_late, f.cs_resched, f.cs_future)
  where s.storage_prefix like '%/late-bound/';
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

-- 11.2 not yet due
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
  '11.2 D < scheduled_start_date → SERVICE_NOT_YET_DUE'
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

-- 11.3 on-time → executed_late false
create temp table _mark_ontime as
select public.service_completion_mark_executed(
  (select cs_ontime from _fx),
  pg_temp.mark_responses((select cs_ontime from _fx)),
  'idem-ontime',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _mark_ontime)
  and (select (payload->>'executed_late')::boolean from _mark_ontime) is false
  and exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ontime
    where e.phase = 'frozen'::public.completion_evidence_phase
      and e.executed_late is false
  ),
  '11.3 on-time mark-executed sets executed_late false'
);

-- 11.4/11.5 late still allowed → executed_late true
create temp table _mark_late as
select public.service_completion_mark_executed(
  (select cs_late from _fx),
  pg_temp.mark_responses((select cs_late from _fx)),
  'idem-late',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _mark_late)
  and (select (payload->>'executed_late')::boolean from _mark_late) is true
  and exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_late
    where e.executed_late is true
  ),
  '11.4/11.5 late mark-executed allowed with executed_late true'
);

-- 11.7 reschedule dates honored: bump late CS into on-time window before mark
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
  and (select (payload->>'executed_late')::boolean from _mark_resched) is false,
  '11.7 after reschedule to today, mark-executed computes executed_late false'
);

-- 11.8 auto-complete does not clear executed_late
select pg_temp.set_service_role();

create temp table _auto as
select public.service_completion_auto_complete_executed(50) as payload;

select ok(
  exists (
    select 1
    from jsonb_array_elements(coalesce((select payload from _auto) -> 'completed', '[]'::jsonb)) e
    join _fx f on (e.value ->> 'contracted_service_id')::uuid = f.cs_auto
  )
  or exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_auto
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  ),
  'auto-complete promotes late EXECUTED CS to COMPLETED'
);

select ok(
  exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_auto
    where e.phase = 'frozen'::public.completion_evidence_phase
      and e.executed_late is true
  ),
  '11.8 auto-complete preserves executed_late on frozen evidence'
);

select * from finish();

rollback;
