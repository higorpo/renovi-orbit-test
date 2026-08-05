-- pgTAP: Task 31 — service_completion_save_evidence_draft CAS, guards, incomplete OK.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(11);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as prop_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as enr_id,
  gen_random_uuid() as sr_exec,
  gen_random_uuid() as prop_exec,
  gen_random_uuid() as cs_exec,
  gen_random_uuid() as enr_exec,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('save draft %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_id as sr_id, 'confirmed' as label from _fx
  union all select sr_exec, 'executed' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(public.service_completion_brt_today(), 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_d date := public.service_completion_brt_today();
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
    format('save draft %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_id as prop_id, sr_id as sr_id, 'c' as label from _fx
    union all select prop_exec, sr_exec, 'e' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_id, f.sr_id, f.prop_id, f.client_id, f.provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status, null
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_exec, f.sr_exec, f.prop_exec, f.client_id, f.provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status, now() - interval '1 hour'
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_id, sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_exec, sr_exec, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  -- Deferred trigger: EXECUTED requires frozen evidence in the same TX
  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    executed_late, responses, idempotency_key
  )
  select
    cs_exec, enr_exec,
    'frozen'::public.completion_evidence_phase,
    now() - interval '1 hour',
    'seed-exec-hash',
    false,
    '{"crit_work_done":{"met":true},"crit_area_clean":{"met":true},"crit_client_access":{"met":true}}'::jsonb,
    'seed-exec-save-draft'
  from _fx;
end;
$seed$;

-- Unauthenticated
select pg_temp.rls_set_anon();

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '{}'::jsonb, null
    )
  $sql$,
  '42501',
  'Authentication required for service_completion_save_evidence_draft',
  'unauthenticated → 42501'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '[]'::jsonb, null
    )
  $sql$,
  '22023',
  'p_responses must be a JSON object',
  'non-object responses → 22023'
);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), null::jsonb, null
    )
  $sql$,
  '22023',
  'p_responses must be a JSON object',
  'null responses → 22023'
);

-- Client is not provider
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '{}'::jsonb, null
    )
  $sql$,
  'P0003',
  'SERVICE_NOT_FOUND_OR_UNAUTHORIZED',
  'non-provider → SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_exec from _fx), '{}'::jsonb, null
    )
  $sql$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'EXECUTED CS → INVALID_STATUS_TRANSITION'
);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '{}'::jsonb, 5
    )
  $sql$,
  'P0001',
  'DRAFT_VERSION_CONFLICT',
  'first insert with expected≠0 → DRAFT_VERSION_CONFLICT'
);

-- Happy: incomplete draft allowed (first insert)
create temp table _draft1 as
select public.service_completion_save_evidence_draft(
  (select cs_id from _fx),
  jsonb_build_object('crit_work_done', jsonb_build_object('met', true)),
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean and (payload->>'draft_version')::int = 1
    and payload->>'phase' = 'draft' from _draft1),
  'first draft creates phase=draft draft_version=1'
);

select ok(
  exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_id
    where e.phase = 'draft'::public.completion_evidence_phase
      and e.draft_version = 1
      and e.checklist_schema_hash is not null
  ),
  'draft row binds READY enrichment schema hash'
);

-- CAS update
create temp table _draft2 as
select public.service_completion_save_evidence_draft(
  (select cs_id from _fx),
  jsonb_build_object(
    'crit_work_done', jsonb_build_object('met', true, 'evidence_paths', jsonb_build_array('a.jpg'))
  ),
  1
) as payload;

select is(
  (select (payload->>'draft_version')::int from _draft2),
  2,
  'matching expected_draft_version bumps to 2'
);

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '{}'::jsonb, 1
    )
  $sql$,
  'P0001',
  'DRAFT_VERSION_CONFLICT',
  'stale expected_draft_version → DRAFT_VERSION_CONFLICT'
);

-- Freeze then EVIDENCE_NOT_DRAFT
update public.contracted_service_completion_evidence e
set
  phase = 'frozen'::public.completion_evidence_phase,
  frozen_at = now(),
  responses_hash = 'frozen-hash',
  executed_late = false,
  idempotency_key = 'freeze-for-draft-test'
from _fx f
where e.contracted_service_id = f.cs_id;

select throws_ok(
  $sql$
    select public.service_completion_save_evidence_draft(
      (select cs_id from _fx), '{}'::jsonb, 2
    )
  $sql$,
  'P0001',
  'EVIDENCE_NOT_DRAFT',
  'frozen evidence → EVIDENCE_NOT_DRAFT'
);

select * from finish();

rollback;
