-- pgTAP: Task 70 — confirm+rating vs auto-complete race + rating uniqueness
-- (Req 14 / 15 / 25.2). Sequential ordering simulates SKIP LOCKED single winner.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(11);

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
  gen_random_uuid() as sr_confirm,
  gen_random_uuid() as prop_confirm,
  gen_random_uuid() as cs_confirm,
  gen_random_uuid() as enr_confirm,
  gen_random_uuid() as sr_auto,
  gen_random_uuid() as prop_auto,
  gen_random_uuid() as cs_auto,
  gen_random_uuid() as enr_auto,
  gen_random_uuid() as sr_cw,
  gen_random_uuid() as prop_cw,
  gen_random_uuid() as cs_cw,
  gen_random_uuid() as enr_cw,
  gen_random_uuid() as sr_aw,
  gen_random_uuid() as prop_aw,
  gen_random_uuid() as cs_aw,
  gen_random_uuid() as enr_aw,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('confirm vs auto %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_confirm as sr_id, 'confirm' as label from _fx
  union all select sr_auto, 'auto' from _fx
  union all select sr_cw, 'cw' from _fx
  union all select sr_aw, 'aw' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date - 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_schema jsonb;
begin
  select checklist_schema into v_schema
  from public.completion_checklist_templates
  where is_global and is_active
  limit 1;

  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('confirm race %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_confirm as prop_id, sr_confirm as sr_id, 'c' as label from _fx
    union all select prop_auto, sr_auto, 'a' from _fx
    union all select prop_cw, sr_cw, 'cw' from _fx
    union all select prop_aw, sr_aw, 'aw' from _fx
  ) x;

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
    select cs_confirm as cs_id, sr_confirm as sr_id, prop_confirm as prop_id from _fx
    union all select cs_auto, sr_auto, prop_auto from _fx
    union all select cs_cw, sr_cw, prop_cw from _fx
    union all select cs_aw, sr_aw, prop_aw from _fx
  ) x;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select x.enr_id, x.sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from (
    select enr_confirm as enr_id, sr_confirm as sr_id from _fx
    union all select enr_auto, sr_auto from _fx
    union all select enr_cw, sr_cw from _fx
    union all select enr_aw, sr_aw from _fx
  ) x;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    executed_late, responses, idempotency_key
  )
  select
    x.cs_id, x.enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '48 hours',
    'hash',
    false,
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-' || x.cs_id::text
  from (
    select cs_confirm as cs_id, enr_confirm as enr_id from _fx
    union all select cs_auto, enr_auto from _fx
    union all select cs_cw, enr_cw from _fx
    union all select cs_aw, enr_aw from _fx
  ) x;
end;
$seed$;

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

-- ---------------------------------------------------------------------------
-- Missing score rolls back
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_confirm from _fx),
      null::smallint, 4::smallint, 4::smallint, 4::smallint,
      null,
      'idem-missing-score'
    )
  $sql$,
  '22023',
  'MISSING_RATING_SCORES',
  '14.2 missing score rejected'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_confirm
    where cs.status = 'EXECUTED'::public.contracted_service_status
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_confirm
  ) = 0,
  '14.2 missing score rolls back — CS stays EXECUTED, no rating'
);

-- ---------------------------------------------------------------------------
-- Manual confirms BEFORE any auto batch (confirm-winner + happy path)
-- ---------------------------------------------------------------------------

create temp table _confirm as
select public.service_completion_confirm_with_rating(
  (select cs_confirm from _fx),
  5::smallint, 4::smallint, 5::smallint, 4::smallint,
  'bom serviço',
  'idem-confirm-ok'
) as payload;

create temp table _cw as
select public.service_completion_confirm_with_rating(
  (select cs_cw from _fx),
  3::smallint, 3::smallint, 3::smallint, 3::smallint,
  null,
  'idem-cw'
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _confirm)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_confirm
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'client'
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_confirm
  ) = 1,
  '14.3/15.2 manual confirm inserts rating and COMPLETED completed_by=client'
);

select ok(
  (select (payload->>'ok')::boolean from _cw)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_cw
    where cs.completed_by = 'client'
  ),
  'confirm-winner CS prepared before auto batch'
);

-- Idempotent replay / rating uniqueness
create temp table _confirm_again as
select public.service_completion_confirm_with_rating(
  (select cs_confirm from _fx),
  5::smallint, 4::smallint, 5::smallint, 4::smallint,
  'bom serviço',
  'idem-confirm-ok'
) as payload;

select ok(
  (select (payload->>'idempotent')::boolean from _confirm_again)
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_confirm
  ) = 1,
  '14.5/25.2 duplicate confirm is idempotent; single rating'
);

-- ---------------------------------------------------------------------------
-- Auto-complete batch: completes only remaining EXECUTED (auto + aw)
-- ---------------------------------------------------------------------------

select pg_temp.set_service_role();

create temp table _auto1 as
select public.service_completion_auto_complete_executed(50) as payload;

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_auto
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_auto
  ) = 0,
  '15.3 auto-complete COMPLETED completed_by=system with zero ratings'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_cw
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'client'
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_cw
  ) = 1
  and not exists (
    select 1
    from jsonb_array_elements(coalesce((select payload from _auto1) -> 'completed', '[]'::jsonb)) e
    join _fx f on (e.value ->> 'contracted_service_id')::uuid = f.cs_cw
  ),
  '14.6 confirm-winner completed_by=client preserved; auto batch skips it'
);

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_aw
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'system'
  )
  and (
    select count(*)::int
    from public.service_ratings r
    join _fx f on r.contracted_service_id = f.cs_aw
  ) = 0,
  'auto-winner CS completed_by=system with zero ratings'
);

-- Second auto batch does not double-complete
create temp table _auto2 as
select public.service_completion_auto_complete_executed(50) as payload;

select ok(
  not exists (
    select 1
    from jsonb_array_elements(coalesce((select payload from _auto2) -> 'completed', '[]'::jsonb)) e
    join _fx f on (e.value ->> 'contracted_service_id')::uuid in (f.cs_auto, f.cs_aw, f.cs_cw, f.cs_confirm)
  ),
  '15.5 second auto-complete batch does not double-complete fixture CS rows'
);

-- Auto-winner: confirm rejected
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $sql$
    select public.service_completion_confirm_with_rating(
      (select cs_aw from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null,
      'idem-aw'
    )
  $sql$,
  'P0001',
  'ALREADY_COMPLETED',
  '14.6 auto-winner: confirm raises ALREADY_COMPLETED'
);

select is(
  (
    select cs.completed_by
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_aw
  ),
  'system',
  'auto-winner completed_by remains system after failed confirm'
);

select * from finish();

rollback;
