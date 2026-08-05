-- pgTAP: Task 32 — service_completion_create_upload_session happy + guards + idempotency.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(11);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

create temp table _fx as
select
  gen_random_uuid() as sr_ok,
  gen_random_uuid() as prop_ok,
  gen_random_uuid() as cs_ok,
  gen_random_uuid() as enr_ok,
  gen_random_uuid() as sr_nocheck,
  gen_random_uuid() as prop_nocheck,
  gen_random_uuid() as cs_nocheck,
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
  format('create upload session %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_ok as sr_id, 'ok' as label from _fx
  union all select sr_nocheck, 'nocheck' from _fx
  union all select sr_exec, 'exec' from _fx
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
    format('upload session %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_ok as prop_id, sr_ok as sr_id, 'ok' as label from _fx
    union all select prop_nocheck, sr_nocheck, 'nocheck' from _fx
    union all select prop_exec, sr_exec, 'exec' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    x.cs_id, x.sr_id, x.prop_id, f.client_id, f.provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot,
    x.status, x.executed_at
  from _fx f
  cross join lateral (
    select cs_ok as cs_id, sr_ok as sr_id, prop_ok as prop_id,
      'CONFIRMED'::public.contracted_service_status as status, null::timestamptz as executed_at
    from _fx
    union all
    select cs_nocheck, sr_nocheck, prop_nocheck,
      'CONFIRMED'::public.contracted_service_status, null
    from _fx
    union all
    select cs_exec, sr_exec, prop_exec,
      'EXECUTED'::public.contracted_service_status, now() - interval '1 hour'
    from _fx
  ) x;

  reset role;

  -- READY enrichment only for cs_ok and cs_exec (nocheck has none)
  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_ok, sr_ok, 'READY'::public.enrichment_status, v_schema,
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
    'seed-exec-upload-session'
  from _fx;
end;
$seed$;

select pg_temp.rls_set_anon();

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_ok from _fx), 'crit_work_done', null
    )
  $sql$,
  '42501',
  'Authentication required for service_completion_create_upload_session',
  'unauthenticated → 42501'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_ok from _fx), '  ', null
    )
  $sql$,
  '22023',
  'p_criterion_block_id is required',
  'blank criterion_block_id → 22023'
);

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_exec from _fx), 'crit_work_done', null
    )
  $sql$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'EXECUTED CS → INVALID_STATUS_TRANSITION'
);

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_nocheck from _fx), 'crit_work_done', null
    )
  $sql$,
  'P0001',
  'CHECKLIST_REQUIRED',
  'no READY enrichment → CHECKLIST_REQUIRED'
);

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_ok from _fx), 'crit_does_not_exist', null
    )
  $sql$,
  'P0002',
  'CRITERION_BLOCK_NOT_FOUND',
  'unknown block id → CRITERION_BLOCK_NOT_FOUND'
);

create temp table _session as
select public.service_completion_create_upload_session(
  (select cs_ok from _fx),
  'crit_work_done',
  'upload-session-idem-a'
) as payload;

select ok(
  (select (payload->>'ok')::boolean
    and (payload->>'idempotent')::boolean = false
    and payload->>'status' = 'open'
    and payload->>'storage_bucket' = 'completion-evidence'
    and (payload->>'max_files')::int = 5
   from _session),
  'happy path: open session in completion-evidence bucket max_files=5'
);

select ok(
  (select payload->>'storage_prefix'
    = (select cs_ok::text || '/' || (payload->>'upload_session_id') || '/' from _fx, _session)
   from _session),
  'storage_prefix is {cs_id}/{session_id}/'
);

select ok(
  (select (payload->>'expires_at')::timestamptz > now() + interval '23 hours'
    and (payload->>'expires_at')::timestamptz < now() + interval '25 hours'
   from _session),
  'expires_at ≈ now + orphan TTL hours (24)'
);

-- Idempotent replay same actor/cs
create temp table _session_replay as
select public.service_completion_create_upload_session(
  (select cs_ok from _fx),
  'crit_work_done',
  'upload-session-idem-a'
) as payload;

select ok(
  (select (payload->>'idempotent')::boolean
    and payload->>'upload_session_id' = (select payload->>'upload_session_id' from _session)
   from _session_replay),
  'same idempotency_key returns same session idempotent=true'
);

-- Conflict: same key claimed by inserting under different CS manually first
insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id,
  storage_bucket, storage_prefix, max_files, expires_at, idempotency_key
)
select
  gen_random_uuid(), cs_nocheck, provider_id, 'crit_work_done',
  'completion-evidence', 'conflict/', 5, now() + interval '1 hour',
  'upload-session-idem-conflict'
from _fx;

-- Need READY enrichment on nocheck for a different path — conflict is on key ownership
select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_ok from _fx),
      'crit_work_done',
      'upload-session-idem-conflict'
    )
  $sql$,
  'P0001',
  'UPLOAD_SESSION_IDEMPOTENCY_CONFLICT',
  'idempotency_key owned by other CS → UPLOAD_SESSION_IDEMPOTENCY_CONFLICT'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_create_upload_session(
      (select cs_ok from _fx), 'crit_work_done', null
    )
  $sql$,
  'P0003',
  'SERVICE_NOT_FOUND_OR_UNAUTHORIZED',
  'client caller → SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
);

select * from finish();

rollback;
