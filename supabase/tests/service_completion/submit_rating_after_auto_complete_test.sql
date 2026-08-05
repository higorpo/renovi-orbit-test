-- pgTAP: Task 39 — after auto-complete (system, no rating), client submit_service_rating works.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(4);

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
  gen_random_uuid() as sr_id,
  gen_random_uuid() as prop_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as enr_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'submit rating after auto complete',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
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
    f.prop_id, f.provider_id, f.sr_id, v_pricing.original_amount,
    'post auto rating',
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_id, f.sr_id, f.prop_id, f.client_id, f.provider_id,
    'days', 1, current_date - 5, current_date - 5, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - make_interval(hours => v_grace + 2)
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_id, sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    executed_late, responses, idempotency_key
  )
  select
    cs_id, enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '30 hours',
    'hash',
    false,
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-post-auto-' || cs_id::text
  from _fx;
end;
$seed$;

select ok(
  has_function_privilege('authenticated', 'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)', 'execute'),
  'authenticated retains EXECUTE on submit_service_rating (Task 39 restore)'
);

select pg_temp.set_service_role();

-- Large batch so pre-existing past-grace EXECUTED rows cannot starve this fixture.
select public.service_completion_auto_complete_executed(5000);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_id
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  ),
  'auto-complete yields COMPLETED completed_by=system'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _rating as
select public.submit_service_rating(
  (select cs_id from _fx),
  4::smallint, 4::smallint, 5::smallint, 3::smallint,
  'após auto-complete'
) as payload;

select ok(
  (select (payload->>'success')::boolean from _rating)
  and exists (
    select 1
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_id
  ),
  'client submit_service_rating succeeds after system auto-complete'
);

select throws_ok(
  $sql$
    select public.submit_service_rating(
      (select cs_id from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      'dup'
    )
  $sql$,
  '23505',
  'rating already exists for contracted service',
  'duplicate submit_service_rating → 23505'
);

select * from finish();

rollback;
