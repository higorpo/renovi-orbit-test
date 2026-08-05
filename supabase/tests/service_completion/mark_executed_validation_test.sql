-- pgTAP: Task 69 — mark-executed validation: unmet negatives, hash, idempotency,
-- missing checklist fail-closed, MMD intent (Req 10 / 12 / 13).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(13);

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
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

create temp table _schema as
select checklist_schema as schema
from public.completion_checklist_templates
where is_global and is_active
limit 1;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('mark executed validation %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_ok as sr_id, 'ok' as label from _fx
  union all select sr_nocheck, 'nocheck' from _fx
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
begin
  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('mark val %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_ok as prop_id, sr_ok as sr_id, 'ok' as label from _fx
    union all select prop_nocheck, sr_nocheck, 'nocheck' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    x.cs_id, x.sr_id, x.prop_id, f.client_id, f.provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f
  cross join lateral (
    select cs_ok as cs_id, sr_ok as sr_id, prop_ok as prop_id from _fx
    union all select cs_nocheck, sr_nocheck, prop_nocheck from _fx
  ) x;

  reset role;

  -- Only cs_ok gets READY enrichment (cs_nocheck fail-closed)
  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select
    enr_ok, sr_ok, 'READY'::public.enrichment_status,
    (select schema from _schema),
    'fallback_template'::public.checklist_source,
    now()
  from _fx;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- Unit: validate_evidence_responses unmet rules (Req 13)
-- ---------------------------------------------------------------------------

select ok(
  not public.service_completion_validate_evidence_responses(
    (select schema from _schema),
    jsonb_build_object(
      'crit_work_done', jsonb_build_object('met', false),
      'crit_area_clean', jsonb_build_object('met', true),
      'crit_client_access', jsonb_build_object('met', true)
    )
  ),
  '13.x unmet without justification/evidence is invalid'
);

select ok(
  not public.service_completion_validate_evidence_responses(
    (select schema from _schema),
    jsonb_build_object(
      'crit_work_done', jsonb_build_object(
        'met', false,
        'justification', 'Faltou material'
      ),
      'crit_area_clean', jsonb_build_object('met', true),
      'crit_client_access', jsonb_build_object('met', true)
    )
  ),
  '13.x unmet with justification but no evidence is invalid'
);

select ok(
  public.service_completion_validate_evidence_responses(
    (select schema from _schema),
    jsonb_build_object(
      'crit_work_done', jsonb_build_object(
        'met', false,
        'justification', 'Faltou material',
        'evidence_paths', jsonb_build_array('cs/unmet.jpg')
      ),
      'crit_area_clean', jsonb_build_object('met', true),
      'crit_client_access', jsonb_build_object('met', true)
    )
  ),
  '13.x unmet with justification + evidence is valid'
);

-- ---------------------------------------------------------------------------
-- Mark-executed negatives leave CONFIRMED
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_mark_executed(
      (select cs_ok from _fx),
      '{}'::jsonb,
      'idem-empty',
      null
    )
  $sql$,
  '22023',
  'CHECKLIST_PAYLOAD_REQUIRED',
  '10.x empty checklist payload rejected'
);

select throws_ok(
  $sql$
    select public.service_completion_mark_executed(
      (select cs_ok from _fx),
      jsonb_build_object(
        'crit_work_done', jsonb_build_object('met', false),
        'crit_area_clean', jsonb_build_object('met', true),
        'crit_client_access', jsonb_build_object('met', true)
      ),
      'idem-unmet-bad',
      null
    )
  $sql$,
  'P0001',
  'INVALID_CHECKLIST_RESPONSES',
  '13.1 unmet without justification/evidence → INVALID_CHECKLIST_RESPONSES'
);

select is(
  (
    select cs.status::text
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_ok
  ),
  'CONFIRMED',
  'reject leaves CS CONFIRMED (no partial EXECUTED)'
);

select throws_ok(
  $sql$
    select public.service_completion_mark_executed(
      (select cs_nocheck from _fx),
      jsonb_build_object(
        'crit_work_done', jsonb_build_object(
          'met', true,
          'evidence_paths', jsonb_build_array('a.jpg')
        ),
        'crit_area_clean', jsonb_build_object('met', true),
        'crit_client_access', jsonb_build_object('met', true)
      ),
      'idem-nocheck',
      null
    )
  $sql$,
  'P0001',
  'CHECKLIST_REQUIRED',
  '13.6 missing READY checklist fail-closed'
);

-- ---------------------------------------------------------------------------
-- Happy: unmet with both → EXECUTED; hash stable; idempotent; MMD intent
-- ---------------------------------------------------------------------------

create temp table _good_responses as
select jsonb_build_object(
  'crit_work_done', jsonb_build_object(
    'met', false,
    'justification', 'Cliente pediu ajuste amanhã',
    'evidence_paths', jsonb_build_array('cs/unmet-ok.jpg')
  ),
  'crit_area_clean', jsonb_build_object('met', true),
  'crit_client_access', jsonb_build_object('met', true)
) as responses;

-- Register evidence path before mark_executed (EVIDENCE_PATH_NOT_REGISTERED guard)
reset role;

insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id, status,
  storage_bucket, storage_prefix, expires_at
)
select
  gen_random_uuid(), cs_ok, provider_id, 'crit_work_done',
  'open'::public.completion_upload_session_status,
  'completion-evidence',
  cs_ok::text || '/mark-val/',
  now() + interval '1 hour'
from _fx;

insert into public.completion_evidence_upload_objects (
  session_id, storage_path, byte_size
)
select s.id, 'cs/unmet-ok.jpg', 1024
from public.completion_evidence_upload_sessions s
join _fx f on s.contracted_service_id = f.cs_ok
where s.storage_prefix = f.cs_ok::text || '/mark-val/';

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

create temp table _mark1 as
select public.service_completion_mark_executed(
  (select cs_ok from _fx),
  (select responses from _good_responses),
  'idem-mark-ok',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean and not coalesce((payload->>'idempotent')::boolean, false)
   from _mark1)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_ok
    where cs.status = 'EXECUTED'::public.contracted_service_status
  )
  and exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ok
    where e.phase = 'frozen'::public.completion_evidence_phase
      and e.responses = (select responses from _good_responses)
      and e.responses_hash is not null
  ),
  '10.x unmet with justification+evidence freezes package and sets EXECUTED'
);

select is(
  (
    select e.responses_hash
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ok
  ),
  encode(
    extensions.digest(
      convert_to((select responses::text from _good_responses), 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  '12.6 responses_hash is stable sha256 of canonical jsonb text'
);

create temp table _mark2 as
select public.service_completion_mark_executed(
  (select cs_ok from _fx),
  (select responses from _good_responses),
  'idem-mark-ok',
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean and (payload->>'idempotent')::boolean from _mark2)
  and (select payload->>'evidence_id' from _mark1)
    = (select payload->>'evidence_id' from _mark2)
  and (select payload->>'responses_hash' from _mark1)
    = (select payload->>'responses_hash' from _mark2)
  and (
    select count(*)::int
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ok
  ) = 1,
  '12.6 idempotent replay returns same evidence_id/hash without duplicating package'
);

select ok(
  (select payload -> 'mmd' is not null from _mark1)
  and (
    coalesce((select (payload -> 'mmd' ->> 'ingested')::int from _mark1), 0) > 0
    or exists (
      select 1
      from message_dispatcher.message_dispatches md
      where md.metadata ->> 'idempotency_key' like
        'service_completion:' || (select cs_ok::text from _fx) || ':executed%'
    )
    or exists (
      select 1
      from message_dispatcher.message_dispatches md
      where md.template_key = 'service.service_executed'
        and md.template_variables ->> 'service_id' = (select cs_ok::text from _fx)
    )
  ),
  'mark-executed emits MMD SERVICE_EXECUTED intent'
);

-- Draft remains provider-side only is covered in RLS Task 60; assert no draft left after freeze
select ok(
  not exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.contracted_service_id = f.cs_ok
    where e.phase = 'draft'::public.completion_evidence_phase
  ),
  'freeze leaves no draft-phase evidence row'
);

select is(
  (
    select count(*)::int
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_nocheck
    where cs.status = 'CONFIRMED'::public.contracted_service_status
  ),
  1,
  'CHECKLIST_REQUIRED reject leaves nocheck CS CONFIRMED'
);

select * from finish();

rollback;
