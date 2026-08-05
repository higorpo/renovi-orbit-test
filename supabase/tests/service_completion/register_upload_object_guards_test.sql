-- pgTAP: Task 33 — service_completion_register_upload_object guards beyond path idempotency.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(10);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

-- Second provider for PROVIDER_MISMATCH
select pg_temp.rls_seed_user(
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'provider',
  'Other provider register test'
);

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as prop_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as enr_id,
  gen_random_uuid() as session_open,
  gen_random_uuid() as session_committed,
  gen_random_uuid() as session_expired,
  gen_random_uuid() as session_max,
  'a1111111-1111-4111-8111-111111111111'::uuid as other_provider_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'register upload object guards',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
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
  v_prefix_open text;
  v_prefix_committed text;
  v_prefix_expired text;
  v_prefix_max text;
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
    'register guards',
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_id, f.sr_id, f.prop_id, f.client_id, f.provider_id,
    'days', 1, v_d, v_d, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select enr_id, sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from _fx;

  select cs_id::text || '/' || session_open::text || '/' into v_prefix_open from _fx;
  select cs_id::text || '/' || session_committed::text || '/' into v_prefix_committed from _fx;
  select cs_id::text || '/' || session_expired::text || '/' into v_prefix_expired from _fx;
  select cs_id::text || '/' || session_max::text || '/' into v_prefix_max from _fx;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id,
    status, storage_bucket, storage_prefix, max_files, expires_at
  )
  select session_open, cs_id, provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence', v_prefix_open, 5, now() + interval '1 hour'
  from _fx;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id,
    status, storage_bucket, storage_prefix, max_files, expires_at
  )
  select session_committed, cs_id, provider_id, 'crit_work_done',
    'committed'::public.completion_upload_session_status,
    'completion-evidence', v_prefix_committed, 5, now() + interval '1 hour'
  from _fx;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id,
    status, storage_bucket, storage_prefix, max_files, expires_at
  )
  select session_expired, cs_id, provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence', v_prefix_expired, 5, now() - interval '1 minute'
  from _fx;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id,
    status, storage_bucket, storage_prefix, max_files, expires_at
  )
  select session_max, cs_id, provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence', v_prefix_max, 1, now() + interval '1 hour'
  from _fx;

  insert into public.completion_evidence_upload_objects (session_id, storage_path, byte_size)
  select session_max, v_prefix_max || 'already.jpg', 10 from _fx;
end;
$seed$;

select pg_temp.rls_set_anon();

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_open from _fx),
      (select cs_id::text || '/' || session_open::text || '/a.jpg' from _fx),
      null, 10
    )
  $sql$,
  '42501',
  'Authentication required for service_completion_register_upload_object',
  'unauthenticated → 42501'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_open from _fx),
      'https://evil.example/x.jpg',
      null, 10
    )
  $sql$,
  '22023',
  'INVALID_STORAGE_PATH',
  'http URL → INVALID_STORAGE_PATH'
);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_open from _fx),
      (select cs_id::text || '/' || session_open::text || '/a.jpg' from _fx),
      null, 0
    )
  $sql$,
  '22023',
  'p_byte_size must be null or > 0',
  'byte_size 0 → 22023'
);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      gen_random_uuid(),
      'x/y/z.jpg',
      null, 10
    )
  $sql$,
  'P0002',
  'UPLOAD_SESSION_NOT_FOUND',
  'missing session → UPLOAD_SESSION_NOT_FOUND'
);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_committed from _fx),
      (select cs_id::text || '/' || session_committed::text || '/a.jpg' from _fx),
      null, 10
    )
  $sql$,
  'P0001',
  'UPLOAD_SESSION_NOT_OPEN',
  'committed session → UPLOAD_SESSION_NOT_OPEN'
);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_expired from _fx),
      (select cs_id::text || '/' || session_expired::text || '/a.jpg' from _fx),
      null, 10
    )
  $sql$,
  'P0001',
  'UPLOAD_SESSION_EXPIRED',
  'past expires_at → UPLOAD_SESSION_EXPIRED'
);

-- Note: the in-RPC status flip to expired is rolled back with the raised exception
-- (statement subtransaction). Assert the guard message only; janitor handles orphans.

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_open from _fx),
      'wrong-prefix/file.jpg',
      null, 10
    )
  $sql$,
  '22023',
  'STORAGE_PATH_PREFIX_MISMATCH',
  'path outside session prefix → STORAGE_PATH_PREFIX_MISMATCH'
);

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_max from _fx),
      (select cs_id::text || '/' || session_max::text || '/second.jpg' from _fx),
      null, 10
    )
  $sql$,
  'P0001',
  'UPLOAD_SESSION_MAX_FILES',
  'at max_files → UPLOAD_SESSION_MAX_FILES'
);

-- Other provider mismatch
select pg_temp.rls_set_auth((select other_provider_id from _fx));

select throws_ok(
  $sql$
    select public.service_completion_register_upload_object(
      (select session_open from _fx),
      (select cs_id::text || '/' || session_open::text || '/a.jpg' from _fx),
      null, 10
    )
  $sql$,
  '42501',
  'UPLOAD_SESSION_PROVIDER_MISMATCH',
  'other provider → UPLOAD_SESSION_PROVIDER_MISMATCH'
);

-- Happy path register
select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

create temp table _reg as
select public.service_completion_register_upload_object(
  (select session_open from _fx),
  (select cs_id::text || '/' || session_open::text || '/ok.jpg' from _fx),
  'sha256:abc',
  42
) as payload;

select ok(
  (select (payload->>'ok')::boolean
    and (payload->>'idempotent')::boolean = false
    and (payload->>'byte_size')::int = 42
   from _reg),
  'happy register under open session prefix'
);

select * from finish();

rollback;
