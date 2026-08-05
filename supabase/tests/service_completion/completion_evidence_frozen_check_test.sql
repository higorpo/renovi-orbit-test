-- pgTAP: service-completion Task 6 — frozen integrity CHECK rejects incomplete freeze.

begin;

select plan(4);

create temp table _ev_fixture as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as proposal_id,
  gen_random_uuid() as cs_id,
  gen_random_uuid() as evidence_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'completion evidence pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _ev_fixture f
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
  where sr.id = (select sr_id from _ev_fixture);

  perform set_config('request.jwt.claim.sub', (select provider_id from _ev_fixture)::text, true);
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
    'evidence pgTAP proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _ev_fixture f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status
  )
  select
    f.cs_id, f.sr_id, f.proposal_id, v_client_id, f.provider_id,
    'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  from _ev_fixture f;
end;
$seed$;

insert into public.contracted_service_completion_evidence (
  id, contracted_service_id, phase
)
select evidence_id, cs_id, 'draft'::public.completion_evidence_phase
from _ev_fixture;

select throws_ok(
  $sql$
    update public.contracted_service_completion_evidence
    set phase = 'frozen'::public.completion_evidence_phase
    where id = (select evidence_id from _ev_fixture)
  $sql$,
  '23514',
  null,
  'frozen without frozen_at/responses_hash/executed_late is rejected'
);

select throws_ok(
  $sql$
    update public.contracted_service_completion_evidence
    set
      phase = 'draft'::public.completion_evidence_phase,
      executed_late = false
    where id = (select evidence_id from _ev_fixture)
  $sql$,
  '23514',
  null,
  'draft with executed_late set is rejected by draft_no_late CHECK'
);

select lives_ok(
  $sql$
    update public.contracted_service_completion_evidence
    set
      phase = 'frozen'::public.completion_evidence_phase,
      frozen_at = now(),
      responses_hash = 'abc',
      executed_late = false,
      responses = '{"ok":true}'::jsonb
    where id = (select evidence_id from _ev_fixture)
  $sql$,
  'complete freeze fields are accepted'
);

select throws_ok(
  $sql$
    insert into public.contracted_service_completion_evidence (
      contracted_service_id, phase
    )
    select cs_id, 'draft'::public.completion_evidence_phase from _ev_fixture
  $sql$,
  '23505',
  null,
  'UNIQUE(contracted_service_id) rejects duplicate evidence package'
);

select finish();

rollback;
