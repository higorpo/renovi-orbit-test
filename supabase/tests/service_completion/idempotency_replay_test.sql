-- pgTAP: Task 62 — idempotency/replay for mark-executed, confirm, upload register,
-- and sequential confirm vs auto-complete single-winner (design §5.6 / §7.1 / Req 12, 14, 18).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(17);

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
  -- CS1: mark + confirm + upload register
  gen_random_uuid() as sr1,
  gen_random_uuid() as prop1,
  gen_random_uuid() as cs1,
  gen_random_uuid() as enr1,
  gen_random_uuid() as session1,
  -- CS2: auto-complete wins
  gen_random_uuid() as sr2,
  gen_random_uuid() as prop2,
  gen_random_uuid() as cs2,
  gen_random_uuid() as enr2,
  -- CS3: confirm wins
  gen_random_uuid() as sr3,
  gen_random_uuid() as prop3,
  gen_random_uuid() as cs3,
  gen_random_uuid() as enr3,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('idempotency replay %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr1 as sr_id, 'mark_confirm' as label from _fx
  union all select sr2, 'auto_wins' from _fx
  union all select sr3, 'confirm_wins' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_schema jsonb;
begin
  select checklist_schema
  into v_schema
  from public.completion_checklist_templates
  where is_global and is_active
  limit 1;

  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('idempotency proposal %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop1 as prop_id, sr1 as sr_id, '1' as label from _fx
    union all select prop2, sr2, '2' from _fx
    union all select prop3, sr3, '3' from _fx
  ) x;

  -- CS1 CONFIRMED (due today) for mark-executed
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    cs1, sr1, prop1, client_id, provider_id,
    'days', 1, current_date, current_date, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx;

  -- CS2/CS3 already EXECUTED past grace (seed frozen evidence below)
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    x.cs_id, x.sr_id, x.prop_id, f.client_id, f.provider_id,
    'days', 1, current_date - 5, current_date - 5, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '48 hours'
  from _fx f
  cross join lateral (
    select cs2 as cs_id, sr2 as sr_id, prop2 as prop_id from _fx
    union all select cs3, sr3, prop3 from _fx
  ) x;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select
    x.enr_id, x.sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from (
    select enr1 as enr_id, sr1 as sr_id from _fx
    union all select enr2, sr2 from _fx
    union all select enr3, sr3 from _fx
  ) x;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    responses, idempotency_key
  )
  select
    x.cs_id, x.enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '48 hours',
    'seed-hash',
    '{"crit_work_done":{"met":true,"evidence_paths":["seed.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-idem-' || x.cs_id::text
  from (
    select cs2 as cs_id, enr2 as enr_id from _fx
    union all select cs3, enr3 from _fx
  ) x;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id, status,
    storage_bucket, storage_prefix, expires_at
  )
  select
    session1, cs1, provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence',
    cs1::text || '/' || session1::text || '/',
    now() + interval '1 hour'
  from _fx;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- Upload path register: duplicate path is idempotent (UNIQUE storage_path)
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

create temp table _upload1 as
select public.service_completion_register_upload_object(
  (select session1 from _fx),
  (select cs1::text || '/' || session1::text || '/photo.jpg' from _fx),
  'checksum-a',
  1024
) as payload;

create temp table _upload2 as
select public.service_completion_register_upload_object(
  (select session1 from _fx),
  (select cs1::text || '/' || session1::text || '/photo.jpg' from _fx),
  'checksum-a',
  1024
) as payload;

select ok(
  (select (payload->>'ok')::boolean and not coalesce((payload->>'idempotent')::boolean, false) from _upload1),
  'upload register first call succeeds (non-idempotent)'
);

select ok(
  (select (payload->>'ok')::boolean and (payload->>'idempotent')::boolean from _upload2)
  and (select payload->>'upload_object_id' from _upload1)
    = (select payload->>'upload_object_id' from _upload2),
  'upload register replay returns same object id'
);

select is(
  (
    select count(*)::int
    from public.completion_evidence_upload_objects o
    join _fx f on o.session_id = f.session1
  ),
  1,
  'duplicate upload path does not insert a second object'
);

-- ---------------------------------------------------------------------------
-- Mark-executed: same idempotency key replays without mutating frozen package
-- ---------------------------------------------------------------------------

create temp table _mark_responses as
select jsonb_build_object(
  'crit_work_done', jsonb_build_object(
    'met', true,
    'evidence_paths', jsonb_build_array(
      (select cs1::text || '/' || session1::text || '/photo.jpg' from _fx)
    )
  ),
  'crit_area_clean', jsonb_build_object('met', true),
  'crit_client_access', jsonb_build_object('met', true)
) as responses;

create temp table _mark1 as
select public.service_completion_mark_executed(
  (select cs1 from _fx),
  (select responses from _mark_responses),
  'idem-mark-cs1',
  null
) as payload;

create temp table _mark2 as
select public.service_completion_mark_executed(
  (select cs1 from _fx),
  (select responses from _mark_responses),
  'idem-mark-cs1',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean and not coalesce((payload->>'idempotent')::boolean, false) from _mark1),
  'mark-executed first call succeeds'
);

select ok(
  (select (payload->>'ok')::boolean and (payload->>'idempotent')::boolean from _mark2)
  and (select payload->>'evidence_id' from _mark1) = (select payload->>'evidence_id' from _mark2)
  and (select payload->>'responses_hash' from _mark1) = (select payload->>'responses_hash' from _mark2),
  'mark-executed replay returns same evidence_id and responses_hash'
);

select is(
  (
    select count(*)::int
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs1
  ),
  1,
  'mark-executed replay does not duplicate evidence row'
);

select throws_ok(
  $sql$
    select public.service_completion_mark_executed(
      (select cs1 from _fx),
      (select responses from _mark_responses),
      'idem-mark-cs1-other-key',
      null
    )
  $sql$,
  'P0001',
  'ALREADY_EXECUTED',
  'mark-executed with different key after success raises ALREADY_EXECUTED'
);

-- Frozen package unchanged after replay
select is(
  (
    select e.responses
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs1
  ),
  (select responses from _mark_responses),
  'frozen responses unchanged after mark replay'
);

-- ---------------------------------------------------------------------------
-- Confirm-with-rating: replay returns same rating_id; no duplicate ratings
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select public.service_completion_upsert_execution_declaration(
  (select cs1 from _fx),
  null, null, null, null, null, null, null, null, null, null, null, null, null
);

create temp table _confirm1 as
select public.service_completion_confirm_with_rating(
  (select cs1 from _fx),
  5::smallint, 4::smallint, 5::smallint, 4::smallint,
  'great work',
  'idem-confirm-cs1'
) as payload;

create temp table _confirm2 as
select public.service_completion_confirm_with_rating(
  (select cs1 from _fx),
  5::smallint, 4::smallint, 5::smallint, 4::smallint,
  'great work',
  'idem-confirm-cs1'
) as payload;

select ok(
  (select (payload->>'ok')::boolean and not coalesce((payload->>'idempotent')::boolean, false) from _confirm1),
  'confirm-with-rating first call succeeds'
);

select ok(
  (select (payload->>'ok')::boolean and (payload->>'idempotent')::boolean from _confirm2)
  and (select payload->>'rating_id' from _confirm1) = (select payload->>'rating_id' from _confirm2),
  'confirm-with-rating replay returns same rating_id'
);

select is(
  (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs1
  ),
  1,
  'confirm replay does not duplicate service_ratings'
);

-- ---------------------------------------------------------------------------
-- Confirm wins (CS3 first): then auto-complete should skip CS3 and claim CS2
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select public.service_completion_upsert_execution_declaration(
  (select cs3 from _fx),
  null, null, null, null, null, null, null, null, null, null, null, null, null
);

create temp table _confirm_cs3 as
select public.service_completion_confirm_with_rating(
  (select cs3 from _fx),
  3::smallint, 3::smallint, 3::smallint, 3::smallint,
  null,
  'idem-confirm-cs3'
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _confirm_cs3)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs3
    where cs.completed_by = 'client'
  ),
  'confirm wins first: CS3 completed_by=client'
);

select pg_temp.set_service_role();

create temp table _auto_batch as
select public.service_completion_auto_complete_executed(50) as payload;

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs2
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  )
  and exists (
    select 1
    from jsonb_array_elements(coalesce((select payload from _auto_batch) -> 'completed', '[]'::jsonb)) e
    join _fx f on (e.value ->> 'contracted_service_id')::uuid = f.cs2
  ),
  'auto-complete wins on CS2 (past grace EXECUTED)'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs3
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'client'
  )
  and not exists (
    select 1
    from jsonb_array_elements(coalesce((select payload from _auto_batch) -> 'completed', '[]'::jsonb)) e
    join _fx f on (e.value ->> 'contracted_service_id')::uuid = f.cs3
  ),
  'confirm winner CS3 skipped by auto-complete batch'
);

select is(
  (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs3
  ),
  1,
  'confirm-then-auto leaves exactly one rating on CS3'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs2 from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null,
      'idem-confirm-cs2'
    )
  $sql$,
  'P0001',
  'ALREADY_COMPLETED',
  'confirm after auto-complete raises ALREADY_COMPLETED'
);

select is(
  (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs2
  ),
  0,
  'auto-complete winner leaves zero ratings on CS2'
);

select * from finish();

rollback;
