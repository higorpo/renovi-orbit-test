-- pgTAP: Tasks 37–38 — auto-complete within grace no-op + cron schedule + job_runs.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(8);

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
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('auto complete grace %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_within as sr_id, 'within' as label from _fx
  union all select sr_past, 'past' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date - 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_schema jsonb;
  v_grace int;
begin
  v_grace := public.platform_constant_int('auto_complete_grace_hours', 24);

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
    format('auto grace %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_within as prop_id, sr_within as sr_id, 'w' as label from _fx
    union all select prop_past, sr_past, 'p' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_within, f.sr_within, f.prop_within, f.client_id, f.provider_id,
    'days', 1, current_date - 5, current_date - 5, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - make_interval(hours => greatest(v_grace - 2, 1))
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_past, f.sr_past, f.prop_past, f.client_id, f.provider_id,
    'days', 1, current_date - 5, current_date - 5, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - make_interval(hours => v_grace + 2)
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

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    executed_late, responses, idempotency_key
  )
  select
    x.cs_id, x.enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '3 hours',
    'hash',
    false,
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-grace-' || x.cs_id::text
  from (
    select cs_within as cs_id, enr_within as enr_id from _fx
    union all select cs_past, enr_past from _fx
  ) x;
end;
$seed$;

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'service_completion_auto_complete_executed'
      and j.schedule = '45 9,15,21,3 * * *'
  ),
  'pg_cron job scheduled at 45 9,15,21,3 * * *'
);

select ok(
  to_regprocedure('public.service_completion_cron_auto_complete_executed()') is not null,
  'cron wrapper function exists'
);

select ok(
  not has_function_privilege('authenticated', 'public.service_completion_cron_auto_complete_executed()', 'execute'),
  'authenticated cannot execute cron wrapper'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$ select public.service_completion_auto_complete_executed(10) $$,
  '42501',
  'service_role required for service_completion_auto_complete_executed',
  'authenticated cannot run auto_complete batch'
);

select pg_temp.set_service_role();

-- Target only our past-grace CS by filtering via batch that includes both;
-- within-grace must remain EXECUTED.
create temp table _batch as
select public.service_completion_auto_complete_executed(5000) as payload;

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_within
    where cs.status = 'EXECUTED'::public.contracted_service_status
  ),
  'within grace: CS stays EXECUTED'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_past
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_past
  ) = 0,
  'past grace: COMPLETED completed_by=system with no rating'
);

-- Cron wrapper writes job_runs
create temp table _cron as
select public.service_completion_cron_auto_complete_executed() as payload;

select ok(
  (select payload ? 'job_run_id' from _cron)
  and exists (
    select 1
    from public.job_runs jr
    where jr.job_name = 'service_completion_cron_auto_complete_executed'
      and jr.id = (select (payload->>'job_run_id')::bigint from _cron)
  ),
  'cron wrapper records job_runs telemetry'
);

select ok(
  (select count(*)::int
   from public.service_ratings r
   join _fx f on r.contracted_service_id in (f.cs_within, f.cs_past)) = 0,
  'auto-complete never inserts ratings'
);

select * from finish();

rollback;
