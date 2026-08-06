-- pgTAP: auto-mark CONFIRMED → EXECUTED after schedule-end + grace (empty checklist).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(9);

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

create temp table _fx as
select
  gen_random_uuid() as sr_within,
  gen_random_uuid() as prop_within,
  gen_random_uuid() as cs_within,
  gen_random_uuid() as enr_within,
  gen_random_uuid() as sr_past,
  gen_random_uuid() as prop_past,
  gen_random_uuid() as cs_past,
  gen_random_uuid() as enr_past,
  gen_random_uuid() as sr_hours,
  gen_random_uuid() as prop_hours,
  gen_random_uuid() as cs_hours,
  gen_random_uuid() as enr_hours,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('auto mark executed %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_within as sr_id, 'within' as label from _fx
  union all select sr_past, 'past' from _fx
  union all select sr_hours, 'hours' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_schema jsonb;
  v_grace int;
  v_past_end date;
  v_within_end date;
begin
  v_grace := public.platform_constant_int('auto_mark_executed_grace_hours', 24);

  -- Past: end-of-day BRT of end_date + grace already elapsed.
  v_past_end := (
    (now() - make_interval(hours => v_grace + 36))
    at time zone 'America/Sao_Paulo'
  )::date;
  -- Within: end date is today — still inside grace after EOD.
  v_within_end := (now() at time zone 'America/Sao_Paulo')::date;

  select checklist_schema into v_schema
  from public.completion_checklist_templates
  where is_global and is_active
  limit 1;

  perform pg_temp.rls_set_jwt(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('auto mark %s', x.label),
    x.dur_value, x.dur_unit, jsonb_build_array(x.slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select
      prop_within as prop_id, sr_within as sr_id, 'w' as label,
      1 as dur_value, 'days'::text as dur_unit,
      jsonb_build_object(
        'start_date', to_char(v_within_end, 'YYYY-MM-DD'),
        'end_date', to_char(v_within_end, 'YYYY-MM-DD'),
        'shift', 'morning'
      ) as slot
    from _fx
    union all
    select
      prop_past, sr_past, 'p',
      1, 'days',
      jsonb_build_object(
        'start_date', to_char(v_past_end, 'YYYY-MM-DD'),
        'end_date', to_char(v_past_end, 'YYYY-MM-DD'),
        'shift', 'full_day'
      )
    from _fx
    union all
    select
      prop_hours, sr_hours, 'h',
      4, 'hours',
      jsonb_build_object(
        'start_date', to_char(v_past_end, 'YYYY-MM-DD'),
        'shift', 'full_day'
      )
    from _fx
  ) x;

  -- Within grace (days with end_date)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_within, f.sr_within, f.prop_within, f.client_id, f.provider_id,
    'days', 1, v_within_end, v_within_end, 'morning',
    jsonb_build_object(
      'start_date', to_char(v_within_end, 'YYYY-MM-DD'),
      'end_date', to_char(v_within_end, 'YYYY-MM-DD'),
      'shift', 'morning'
    ),
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  -- Past grace (days with end_date)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_past, f.sr_past, f.prop_past, f.client_id, f.provider_id,
    'days', 1, v_past_end, v_past_end, 'full_day',
    jsonb_build_object(
      'start_date', to_char(v_past_end, 'YYYY-MM-DD'),
      'end_date', to_char(v_past_end, 'YYYY-MM-DD'),
      'shift', 'full_day'
    ),
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  -- Past grace hours (scheduled_end_date NULL → coalesce to start)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_hours, f.sr_hours, f.prop_hours, f.client_id, f.provider_id,
    'hours', 4, v_past_end, null, 'full_day',
    jsonb_build_object(
      'start_date', to_char(v_past_end, 'YYYY-MM-DD'),
      'shift', 'full_day'
    ),
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_within, sr_within, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_past, sr_past, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_hours, sr_hours, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  -- Draft on past CS — auto-mark must freeze empty responses + flag
  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, responses, draft_version
  )
  select cs_past, enr_past, 'draft'::public.completion_evidence_phase,
    '{"crit_work_done":{"met":true,"evidence_paths":[]}}'::jsonb, 1
  from _fx;
end;
$seed$;

select is(
  public.platform_constant_int('auto_mark_executed_grace_hours', 24),
  24,
  'auto_mark_executed_grace_hours = 24'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'service_completion_auto_mark_executed'
      and j.schedule = '15 9,15,21,3 * * *'
  ),
  'pg_cron job scheduled at 15 9,15,21,3 * * *'
);

select ok(
  to_regprocedure('public.service_completion_cron_auto_mark_executed()') is not null,
  'cron wrapper function exists'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$ select public.service_completion_auto_mark_executed(10) $$,
  '42501',
  'service_role required for service_completion_auto_mark_executed',
  'authenticated cannot run auto_mark batch'
);

select pg_temp.set_service_role();

create temp table _batch as
select public.service_completion_auto_mark_executed(5000) as payload;

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_within
    where cs.status = 'CONFIRMED'::public.contracted_service_status
  ),
  'within grace: CS stays CONFIRMED'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_past
    where cs.status = 'EXECUTED'::public.contracted_service_status
      and cs.executed_at is not null
  )
  and exists (
    select 1
    from public.contracted_service_completion_evidence ev
    join _fx f on ev.contracted_service_id = f.cs_past
    where ev.phase = 'frozen'::public.completion_evidence_phase
      and ev.auto_executed_without_checklist = true
      and ev.responses = '{}'::jsonb
  ),
  'past grace days: EXECUTED with empty frozen checklist + flag'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_hours
    where cs.status = 'EXECUTED'::public.contracted_service_status
  )
  and exists (
    select 1
    from public.contracted_service_completion_evidence ev
    join _fx f on ev.contracted_service_id = f.cs_hours
    where ev.phase = 'frozen'::public.completion_evidence_phase
      and ev.auto_executed_without_checklist = true
      and ev.responses = '{}'::jsonb
  ),
  'past grace hours (null end_date): EXECUTED using start_date coalesce'
);

-- Helper: coalesce(end, start)
select is(
  public.service_completion_scheduled_end_at(
    date '2026-08-01',
    null
  ),
  public.service_completion_scheduled_end_at(
    date '2026-08-01',
    date '2026-08-01'
  ),
  'scheduled_end_at null end_date equals start_date end-of-day'
);

create temp table _cron as
select public.service_completion_cron_auto_mark_executed() as payload;

select ok(
  exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'service_completion_cron_auto_mark_executed'
    order by jr.id desc
    limit 1
  ),
  'cron wrapper writes job_runs'
);

select * from finish();
rollback;
