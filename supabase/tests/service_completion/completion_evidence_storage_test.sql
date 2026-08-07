-- pgTAP: Task 10 — completion-evidence bucket, path helpers, storage policies.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(13);

select ok(
  exists (
    select 1
    from storage.buckets b
    where b.id = 'completion-evidence'
      and b.public = false
  ),
  'completion-evidence bucket exists and is private'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_completion_evidence_select'
  ),
  'storage select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_completion_evidence_insert'
  ),
  'storage insert policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_completion_evidence_service_role'
  ),
  'storage service_role policy exists'
);

select ok(
  not public.service_completion_evidence_storage_path_owned('')
  and not public.service_completion_evidence_storage_path_owned('https://evil.example/x')
  and not public.service_completion_evidence_storage_path_owned(E'a\nb'),
  'path_owned rejects empty, http URL, and newlines'
);

select ok(
  not public.service_completion_evidence_storage_upload_allowed(''),
  'upload_allowed rejects empty path'
);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as prop_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as session_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, f.client_id, sr.service_id, sr.address_id,
  'completion evidence storage',
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_prefix text;
begin
  perform pg_temp.rls_set_jwt(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    f.prop_id, f.provider_id, f.sr_id, v_pricing.original_amount,
    'storage helpers',
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

  select cs_id::text || '/' || session_id::text || '/' into v_prefix from _fx;

  insert into public.completion_evidence_upload_sessions (
    id, contracted_service_id, provider_id, criterion_block_id,
    status, storage_bucket, storage_prefix, max_files, expires_at
  )
  select
    session_id, cs_id, provider_id, 'crit_work_done',
    'open'::public.completion_upload_session_status,
    'completion-evidence', v_prefix, 5, now() + interval '1 hour'
  from _fx;
end;
$seed$;

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select ok(
  public.service_completion_evidence_storage_path_owned(
    (select cs_id::text || '/' || session_id::text || '/photo.jpg' from _fx)
  ),
  'path_owned true for provider-owned session prefix'
);

select ok(
  public.service_completion_evidence_storage_upload_allowed(
    (select cs_id::text || '/' || session_id::text || '/photo.jpg' from _fx)
  ),
  'upload_allowed true for open owned session (3+ path parts)'
);

select ok(
  not public.service_completion_evidence_storage_upload_allowed(
    (select cs_id::text || '/not-a-session/photo.jpg' from _fx)
  ),
  'upload_allowed false when session id does not match an open session'
);

-- Non-owner cannot claim path ownership
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  not public.service_completion_evidence_storage_path_owned(
    (select cs_id::text || '/' || session_id::text || '/photo.jpg' from _fx)
  ),
  'path_owned false for non-provider actor'
);

-- Client cannot read storage until evidence is frozen
select ok(
  not public.service_completion_evidence_storage_path_client_readable(
    (select cs_id::text || '/' || session_id::text || '/photo.jpg' from _fx)
  ),
  'client_readable false while evidence not frozen'
);

insert into public.contracted_service_completion_evidence (
  contracted_service_id, phase, frozen_at, responses_hash, responses
)
select
  cs_id,
  'frozen'::public.completion_evidence_phase,
  now(),
  'hash',
  '{"crit_work_done":{"met":true,"evidence_paths":["x.jpg"]}}'::jsonb
from _fx;

select ok(
  public.service_completion_evidence_storage_path_client_readable(
    (select cs_id::text || '/' || session_id::text || '/photo.jpg' from _fx)
  ),
  'client_readable true for CS client after evidence frozen'
);

select ok(
  not public.service_completion_evidence_storage_path_client_readable('')
  and not public.service_completion_evidence_storage_path_client_readable('https://evil.example/x'),
  'client_readable rejects empty and http URL'
);

select * from finish();

rollback;
