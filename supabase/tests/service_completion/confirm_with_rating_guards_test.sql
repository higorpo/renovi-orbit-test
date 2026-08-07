-- pgTAP: Task 36 — confirm_with_rating additional guards (range, actor, wrong status).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(6);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

create temp table _fx as
select
  gen_random_uuid() as sr_exec,
  gen_random_uuid() as prop_exec,
  gen_random_uuid() as cs_exec,
  gen_random_uuid() as enr_exec,
  gen_random_uuid() as sr_conf,
  gen_random_uuid() as prop_conf,
  gen_random_uuid() as cs_conf,
  gen_random_uuid() as enr_conf,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('confirm guards %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_exec as sr_id, 'exec' as label from _fx
  union all select sr_conf, 'conf' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date - 2, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_schema jsonb;
begin
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
    format('confirm guards %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_exec as prop_id, sr_exec as sr_id, 'e' as label from _fx
    union all select prop_conf, sr_conf, 'c' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_exec, f.sr_exec, f.prop_exec, f.client_id, f.provider_id,
    'days', 1, current_date - 2, current_date - 2, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status, now() - interval '2 hours'
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_conf, f.sr_conf, f.prop_conf, f.client_id, f.provider_id,
    'days', 1, current_date - 2, current_date - 2, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_exec, sr_exec, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_conf, sr_conf, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    responses, idempotency_key
  )
  select
    cs_exec, enr_exec,
    'frozen'::public.completion_evidence_phase,
    now() - interval '2 hours',
    'hash',
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-confirm-guards-' || cs_exec::text
  from _fx;
end;
$seed$;

select pg_temp.rls_set_anon();

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_exec from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, null
    )
  $sql$,
  '42501',
  'Authentication required for service_completion_confirm_with_rating',
  'unauthenticated → 42501'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_exec from _fx),
      0::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-range'
    )
  $sql$,
  '22023',
  'RATING_SCORES_OUT_OF_RANGE',
  'score 0 → RATING_SCORES_OUT_OF_RANGE'
);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_exec from _fx),
      6::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-range-hi'
    )
  $sql$,
  '22023',
  'RATING_SCORES_OUT_OF_RANGE',
  'score 6 → RATING_SCORES_OUT_OF_RANGE'
);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_conf from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-confirmed'
    )
  $sql$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'CONFIRMED CS → INVALID_STATUS_TRANSITION'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_exec from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-provider'
    )
  $sql$,
  'P0003',
  'SERVICE_NOT_FOUND_OR_UNAUTHORIZED',
  'provider caller → SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
);

-- Happy confirm (complements race suite)
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _ok as
select public.service_completion_confirm_with_rating(
  (select cs_exec from _fx),
  5::smallint, 4::smallint, 3::smallint, 5::smallint,
  'ok',
  'idem-confirm-guards-ok'
) as payload;

select ok(
  (select (payload->>'ok')::boolean
    and payload->>'completed_by' = 'client'
    and payload->>'status' = 'COMPLETED'
    and payload->>'rating_id' is not null
   from _ok)
  and exists (
    select 1 from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_exec
    where r.score_quality = 5 and r.overall_score is not null
  ),
  'happy confirm: COMPLETED completed_by=client with rating row'
);

select * from finish();

rollback;
