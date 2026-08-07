-- pgTAP: execution declaration upsert + confirm gate (EXECUTION_DECLARATION_REQUIRED).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(7);

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
  'execution declaration test',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
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
    f.prop_id, f.provider_id, f.sr_id, v_pricing.original_amount,
    'execution declaration',
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
    'days', 1, current_date - 2, current_date - 2, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status, now() - interval '2 hours'
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
    responses, idempotency_key
  )
  select
    cs_id, enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '2 hours',
    'hash',
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-exec-decl-' || cs_id::text
  from _fx;
end;
$seed$;

-- Confirm without declaration
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_id from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-no-decl'
    )
  $sql$,
  'P0001',
  'EXECUTION_DECLARATION_REQUIRED',
  'confirm without declaration → EXECUTION_DECLARATION_REQUIRED'
);

-- First upsert creates one row
create temp table _decl1 as
select public.service_completion_upsert_execution_declaration(
  (select cs_id from _fx),
  '203.0.113.10',
  '{"country":"Brazil","region":"SP","city":"São Paulo","source":"ipwho.is"}'::jsonb,
  'device-1',
  'android',
  'android',
  '14',
  'Google',
  'Pixel',
  'Phone',
  false,
  '120',
  'Mozilla/5.0',
  'America/Sao_Paulo'
) as payload;

select ok(
  (select (payload->>'ok')::boolean and payload->>'id' is not null from _decl1)
  and (
    select count(*)::int
    from public.service_completion_execution_declarations d
    join _fx f on d.contracted_service_id = f.cs_id
  ) = 1,
  'first upsert creates exactly one declaration row'
);

create temp table _declared_at as
select d.declared_at, d.id
from public.service_completion_execution_declarations d
join _fx f on d.contracted_service_id = f.cs_id;

-- Second upsert does not duplicate and preserves declared_at
select pg_sleep(0.05);

create temp table _decl2 as
select public.service_completion_upsert_execution_declaration(
  (select cs_id from _fx),
  '198.51.100.20',
  null,
  'device-2',
  'web',
  'linux',
  null,
  null,
  null,
  null,
  null,
  null,
  'Mozilla/5.0 Chrome',
  'UTC'
) as payload;

select is(
  (
    select count(*)::int
    from public.service_completion_execution_declarations d
    join _fx f on d.contracted_service_id = f.cs_id
  ),
  1,
  'second upsert does not duplicate declaration row'
);

select is(
  (
    select d.declared_at
    from public.service_completion_execution_declarations d
    join _fx f on d.contracted_service_id = f.cs_id
  ),
  (select declared_at from _declared_at),
  'second upsert preserves declared_at'
);

select is(
  (
    select d.device_id
    from public.service_completion_execution_declarations d
    join _fx f on d.contracted_service_id = f.cs_id
  ),
  'device-2',
  'second upsert refreshes device metadata'
);

-- Provider cannot upsert
select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_upsert_execution_declaration(
      (select cs_id from _fx),
      null, null, null, null, null, null, null, null, null, null, null, null, null
    )
  $sql$,
  'P0003',
  'SERVICE_NOT_FOUND_OR_UNAUTHORIZED',
  'provider upsert → SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
);

-- Confirm succeeds after declaration
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _ok as
select public.service_completion_confirm_with_rating(
  (select cs_id from _fx),
  5::smallint, 4::smallint, 3::smallint, 5::smallint,
  'ok',
  'idem-with-decl'
) as payload;

select ok(
  (select (payload->>'ok')::boolean and payload->>'status' = 'COMPLETED' from _ok),
  'confirm with declaration succeeds'
);

select * from finish();

rollback;
