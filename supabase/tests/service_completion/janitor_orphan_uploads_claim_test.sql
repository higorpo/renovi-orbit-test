-- pgTAP: Task 57 — orphan janitor (SQL-only) deletes unreferenced; skips frozen; expires sessions.

begin;

select plan(8);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select throws_ok(
  $$ select public.service_completion_janitor_orphan_uploads(10) $$,
  '42501',
  null,
  'janitor rejects non-service_role'
);

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as proposal_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as session_orphan,
  gen_random_uuid() as session_frozen,
  gen_random_uuid() as obj_orphan,
  gen_random_uuid() as obj_frozen,
  gen_random_uuid() as session_open_expired,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id,
  'cs/' || gen_random_uuid()::text || '/orphan.jpg' as path_orphan,
  'cs/' || gen_random_uuid()::text || '/frozen.jpg' as path_frozen;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'orphan janitor pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

do $seed$
declare
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  select sr.client_id into v_client_id
  from public.service_requests sr
  where sr.id = (select sr_id from _fx);

  perform set_config('request.jwt.claim.sub', (select provider_id from _fx)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    f.proposal_id, f.provider_id, f.sr_id, v_pricing.original_amount,
    'orphan janitor proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_id, f.sr_id, f.proposal_id, v_client_id, f.provider_id,
    'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _fx f;
end;
$seed$;

-- Orphan object (old, unreferenced)
insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id, status,
  storage_bucket, storage_prefix, expires_at
)
select
  session_orphan, cs_id, provider_id, 'c1',
  'committed'::public.completion_upload_session_status,
  'completion-evidence',
  cs_id::text || '/' || session_orphan::text,
  now() - interval '48 hours'
from _fx;

insert into public.completion_evidence_upload_objects (
  id, session_id, storage_path, registered_at, referenced_in_responses
)
select
  obj_orphan, session_orphan, path_orphan,
  now() - interval '48 hours', false
from _fx;

-- Frozen-referenced object (old, flag false — flag drift simulation)
insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id, status,
  storage_bucket, storage_prefix, expires_at
)
select
  session_frozen, cs_id, provider_id, 'c2',
  'committed'::public.completion_upload_session_status,
  'completion-evidence',
  cs_id::text || '/' || session_frozen::text,
  now() - interval '48 hours'
from _fx;

insert into public.completion_evidence_upload_objects (
  id, session_id, storage_path, registered_at, referenced_in_responses
)
select
  obj_frozen, session_frozen, path_frozen,
  now() - interval '48 hours', false
from _fx;

insert into public.contracted_service_completion_evidence (
  contracted_service_id, phase, frozen_at, responses_hash, responses
)
select
  cs_id,
  'frozen'::public.completion_evidence_phase,
  now(),
  'hash',
  jsonb_build_object(
    'c2',
    jsonb_build_object(
      'met', true,
      'evidence_paths', jsonb_build_array(path_frozen)
    )
  )
from _fx;

-- Expired open session past TTL
insert into public.completion_evidence_upload_sessions (
  id, contracted_service_id, provider_id, criterion_block_id, status,
  storage_bucket, storage_prefix, expires_at
)
select
  session_open_expired, cs_id, provider_id, 'c3',
  'open'::public.completion_upload_session_status,
  'completion-evidence',
  cs_id::text || '/' || session_open_expired::text,
  now() - interval '48 hours'
from _fx;

select pg_temp.set_service_role();

create temp table _run as
select public.service_completion_janitor_orphan_uploads(50) as payload;

select ok(
  (select (payload->>'ok')::boolean from _run),
  'janitor succeeds'
);

select ok(
  (select (payload->>'sessions_marked_expired')::int >= 1 from _run),
  'expired open session marked expired'
);

select ok(
  exists (
    select 1
    from public.completion_evidence_upload_sessions s
    join _fx f on s.id = f.session_open_expired
    where s.status = 'expired'::public.completion_upload_session_status
  ),
  'open session past TTL is now expired'
);

select ok(
  (select (payload->>'objects_deleted')::int >= 1 from _run)
  and not exists (
    select 1
    from public.completion_evidence_upload_objects o
    join _fx f on o.id = f.obj_orphan
  ),
  'unreferenced orphan object registry row deleted'
);

select ok(
  exists (
    select 1
    from public.completion_evidence_upload_objects o
    join _fx f on o.id = f.obj_frozen
    where o.referenced_in_responses = true
  ),
  'frozen-referenced path is retained and flagged referenced'
);

select ok(
  (select (payload->>'skipped_frozen')::int >= 1 from _run),
  'janitor reports skipped_frozen for defensive frozen hit'
);

select ok(
  (select (payload->>'delete_failures')::int = 0 from _run),
  'no delete failures on happy path'
);

select finish();

rollback;
