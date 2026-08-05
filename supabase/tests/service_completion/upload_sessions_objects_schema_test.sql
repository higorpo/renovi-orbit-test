-- pgTAP: Tasks 7–8 — upload sessions/objects schema constraints and indexes.

begin;

select plan(10);

select ok(
  to_regclass('public.completion_evidence_upload_sessions') is not null
  and to_regclass('public.completion_evidence_upload_objects') is not null,
  'upload sessions and objects tables exist'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_upload_sessions_orphan'
  ),
  'partial index idx_upload_sessions_orphan exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_upload_objects_janitor_claim'
  ),
  'partial index idx_upload_objects_janitor_claim exists (unref/orphan claim)'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_upload_objects_session'
  ),
  'index idx_upload_objects_session exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.completion_evidence_upload_sessions'::regclass
      and contype = 'u'
      and conname = 'upload_session_idem_uk'
  ),
  'upload_session_idem_uk UNIQUE on idempotency_key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.completion_evidence_upload_objects'::regclass
      and contype = 'u'
      and conname = 'upload_object_path_uk'
  ),
  'upload_object_path_uk UNIQUE on storage_path'
);

-- Fixture CS for FK inserts (clone template SR → proposal → CS)
create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as prop_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as session_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'upload schema fixture',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  perform set_config('request.jwt.claim.sub', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', '5d09e025-20a2-4842-aeef-324d42a431e1'
    )::text,
    true
  );

  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    f.prop_id, f.provider_id, f.sr_id, v_pricing.original_amount,
    'upload schema',
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
    'days', 1, current_date, current_date, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f;

  reset role;
end;
$seed$;

select throws_ok(
  $sql$
    insert into public.completion_evidence_upload_sessions (
      id, contracted_service_id, provider_id, criterion_block_id,
      storage_bucket, storage_prefix, max_files, expires_at
    )
    select
      gen_random_uuid(), cs_id, provider_id, 'crit_work_done',
      'completion-evidence', cs_id::text || '/x/', 0, now() + interval '1 hour'
    from _fx
  $sql$,
  '23514',
  null,
  'max_files >= 1 CHECK rejects 0'
);

insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id,
  storage_bucket, storage_prefix, max_files, expires_at, idempotency_key
)
select
  session_id, cs_id, provider_id, 'crit_work_done',
  'completion-evidence',
  cs_id::text || '/' || session_id::text || '/',
  2,
  now() + interval '1 hour',
  'upload-schema-idem-1'
from _fx;

select throws_ok(
  $sql$
    insert into public.completion_evidence_upload_sessions (
      id, contracted_service_id, provider_id, criterion_block_id,
      storage_bucket, storage_prefix, max_files, expires_at, idempotency_key
    )
    select
      gen_random_uuid(), cs_id, provider_id, 'crit_area_clean',
      'completion-evidence', 'dup/', 2, now() + interval '1 hour',
      'upload-schema-idem-1'
    from _fx
  $sql$,
  '23505',
  null,
  'duplicate idempotency_key rejected'
);

insert into public.completion_evidence_upload_objects (
  session_id, storage_path, byte_size
)
select
  session_id,
  cs_id::text || '/' || session_id::text || '/file-a.jpg',
  100
from _fx;

select throws_ok(
  $sql$
    insert into public.completion_evidence_upload_objects (session_id, storage_path, byte_size)
    select session_id, cs_id::text || '/' || session_id::text || '/file-a.jpg', 50 from _fx
  $sql$,
  '23505',
  null,
  'duplicate storage_path rejected'
);

select throws_ok(
  $sql$
    insert into public.completion_evidence_upload_objects (session_id, storage_path, byte_size)
    select session_id, cs_id::text || '/' || session_id::text || '/bad.jpg', 0 from _fx
  $sql$,
  '23514',
  null,
  'byte_size CHECK rejects 0'
);

select * from finish();

rollback;
