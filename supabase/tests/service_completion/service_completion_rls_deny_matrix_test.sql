-- pgTAP: Task 60 — service-completion RLS deny matrix (design §11.2 / Req 8, 11, 23).
-- AC: draft hidden from client; frozen not for other providers; enrichments no client SELECT;
-- authenticated cannot write; worker RPCs service_role only.

begin;

\ir fixtures/seed_rls_actors.inc

-- Override JWT-only helper: RLS deny matrix needs SET ROLE authenticated so
-- table privileges + policies are evaluated (product reads enrichments via DEFINER only).
create or replace function pg_temp.rls_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.rls_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
end;
$$;

select plan(19);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_a_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.provider_c_id', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('rls.service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(current_setting('rls.provider_c_id')::uuid, 'provider', 'Provider C outsider');

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as proposal_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as enr_pending_id,
  gen_random_uuid() as evidence_draft_id,
  gen_random_uuid() as session_id,
  gen_random_uuid() as object_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_a_id')::uuid as provider_a_id,
  current_setting('rls.provider_c_id')::uuid as provider_c_id;

create temp table _fx_ready as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id,
  current_setting('rls.client_id')::uuid as client_id;

create temp table _fx_frozen as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as proposal_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as evidence_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_a_id')::uuid as provider_a_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'service completion RLS deny matrix',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = current_setting('rls.service_request_id')::uuid;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'service completion RLS ready',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx_ready f
join public.service_requests sr on sr.id = current_setting('rls.service_request_id')::uuid;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'service completion RLS frozen',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx_frozen f
join public.service_requests sr on sr.id = current_setting('rls.service_request_id')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_slot2 jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 11, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  );
begin
  -- Seed as postgres (JWT only); SET ROLE authenticated is for assertion sections.
  reset role;
  perform set_config(
    'request.jwt.claim.sub',
    current_setting('rls.provider_a_id'),
    true
  );
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', current_setting('rls.provider_a_id')
    )::text,
    true
  );

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    f.proposal_id, f.provider_a_id, f.sr_id, v_pricing.original_amount,
    'RLS deny matrix proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_id, f.sr_id, f.proposal_id, f.client_id, f.provider_a_id,
    'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  select * into v_pricing
  from public.calculate_provider_service_pricing(120.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    f.proposal_id, f.provider_a_id, f.sr_id, v_pricing.original_amount,
    'RLS frozen proposal', 1, 'days', jsonb_build_array(v_slot2),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx_frozen f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_id, f.sr_id, f.proposal_id, f.client_id, f.provider_a_id,
    'days', 1, current_date + 11, current_date + 11, 'afternoon', v_slot2,
    'EXECUTED'::public.contracted_service_status
  from _fx_frozen f;
end;
$seed$;

reset role;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count
)
select enr_pending_id, sr_id, 'PENDING'::public.enrichment_status, 0
from _fx;

insert into public.service_request_enrichments (
  id, service_request_id, status, checklist_schema, source, materialized_at
)
select
  enr_id,
  sr_id,
  'READY'::public.enrichment_status,
  (select checklist_schema from public.completion_checklist_templates where is_global and is_active limit 1),
  'ai'::public.checklist_source,
  now()
from _fx_ready;

insert into public.contracted_service_completion_evidence (
  id, contracted_service_id, phase, responses
)
select
  evidence_draft_id, cs_id, 'draft'::public.completion_evidence_phase,
  '{"c1":{"met":true,"justification":"secret draft"}}'::jsonb
from _fx;

insert into public.contracted_service_completion_evidence (
  id, contracted_service_id, phase, frozen_at, responses_hash, executed_late, responses
)
select
  evidence_id, cs_id, 'frozen'::public.completion_evidence_phase,
  now(), 'hash', false,
  '{"c1":{"met":true,"evidence_paths":["x/y.jpg"]}}'::jsonb
from _fx_frozen;

insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id, status,
  storage_bucket, storage_prefix, expires_at
)
select
  session_id, cs_id, provider_a_id, 'c1',
  'open'::public.completion_upload_session_status,
  'completion-evidence', cs_id::text || '/' || session_id::text,
  now() + interval '1 hour'
from _fx;

insert into public.completion_evidence_upload_objects (
  id, session_id, storage_path, referenced_in_responses
)
select object_id, session_id, cs_id::text || '/obj.jpg', false
from _fx;

-- Allow SET ROLE authenticated to read fixture IDs (temp tables are owned by postgres)
grant select on _fx, _fx_ready, _fx_frozen to authenticated;

-- Structural grants ----------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.service_request_enrichments', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.service_request_enrichments', 'INSERT')
    and not has_table_privilege('authenticated', 'public.service_request_enrichments', 'DELETE')
    and not has_table_privilege('authenticated', 'public.service_request_enrichments', 'SELECT'),
  'authenticated lacks SELECT/INSERT/UPDATE/DELETE on enrichments'
);

select ok(
  not has_table_privilege('authenticated', 'public.contracted_service_completion_evidence', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.contracted_service_completion_evidence', 'INSERT'),
  'authenticated lacks INSERT/UPDATE on completion evidence'
);

select ok(
  not has_table_privilege('authenticated', 'public.completion_checklist_templates', 'SELECT'),
  'authenticated lacks SELECT on checklist templates (deny-by-default)'
);

select ok(
  not has_table_privilege('authenticated', 'public.service_request_enrichment_events', 'SELECT'),
  'authenticated lacks SELECT on enrichment_events'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'enrichment_claim_batch'
      limit 1
    ),
    'execute'
  ),
  'authenticated cannot EXECUTE enrichment_claim_batch'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'enrichment_finalize_ready'
      limit 1
    ),
    'execute'
  ),
  'authenticated cannot EXECUTE enrichment_finalize_ready'
);

select ok(
  not has_function_privilege(
    'authenticated',
    (
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'service_completion_auto_complete_executed'
      limit 1
    ),
    'execute'
  ),
  'authenticated cannot EXECUTE service_completion_auto_complete_executed'
);

-- Client --------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  format(
    $sql$
      select e.checklist_schema
      from public.service_request_enrichments e
      where e.id = %L::uuid
    $sql$,
    (select enr_pending_id from _fx)
  ),
  '42501',
  null,
  'client cannot SELECT enrichment rows directly (PENDING)'
);

select throws_ok(
  format(
    $sql$
      select e.checklist_schema
      from public.service_request_enrichments e
      where e.id = %L::uuid
    $sql$,
    (select enr_id from _fx_ready)
  ),
  '42501',
  null,
  'client cannot SELECT enrichment rows directly (READY; use get_service_completion_context)'
);

select is(
  (
    select count(*)::int
    from public.contracted_service_completion_evidence e
    join _fx f on e.id = f.evidence_draft_id
  ),
  0,
  'client cannot SELECT draft responses (draft hidden)'
);

select ok(
  exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx_frozen f on e.id = f.evidence_id
  ),
  'client can SELECT frozen evidence for own CS'
);

select throws_ok(
  format(
    $sql$
      update public.service_request_enrichments
      set attempt_count = attempt_count + 1
      where id = %L::uuid
    $sql$,
    (select enr_pending_id from _fx)
  ),
  '42501',
  null,
  'authenticated cannot UPDATE enrichment FSM columns directly'
);

select throws_ok(
  format(
    $sql$
      update public.contracted_service_completion_evidence
      set responses = '{}'::jsonb
      where id = %L::uuid
    $sql$,
    (select evidence_draft_id from _fx)
  ),
  '42501',
  null,
  'authenticated cannot UPDATE evidence freeze/response columns directly'
);

-- Outsider provider C -------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (
    select count(*)::int
    from public.contracted_service_completion_evidence e
    join _fx_frozen f on e.id = f.evidence_id
  ),
  0,
  'other providers cannot read frozen responses'
);

select throws_ok(
  format(
    $sql$
      select e.id
      from public.service_request_enrichments e
      where e.id = %L::uuid
    $sql$,
    (select enr_id from _fx_ready)
  ),
  '42501',
  null,
  'other providers cannot SELECT client enrichment rows'
);

select is(
  (
    select count(*)::int
    from public.completion_evidence_upload_sessions s
    join _fx f on s.id = f.session_id
  ),
  0,
  'other providers cannot SELECT foreign upload sessions'
);

-- Contracted provider A -----------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_a_id')::uuid);

select ok(
  exists (
    select 1
    from public.contracted_service_completion_evidence e
    join _fx f on e.id = f.evidence_draft_id
  ),
  'contracted provider can SELECT draft evidence'
);

select ok(
  exists (
    select 1
    from public.completion_evidence_upload_sessions s
    join _fx f on s.id = f.session_id
  ),
  'contracted provider can SELECT own upload sessions'
);

select throws_ok(
  $$ select public.enrichment_claim_batch('worker-rls', 1) $$,
  '42501',
  null,
  'worker RPC enrichment_claim_batch denied to authenticated (runtime)'
);

select finish();

rollback;
