-- pgTAP: Task 63 — partial indexes for claim/reclaim/auto-complete + EXPLAIN usage.
-- Notes (expected planner with enable_seqscan=off on seeded rows):
--   claim  → Index Scan / Bitmap Index Scan using idx_enrichments_claim_due
--   reclaim → idx_enrichments_lease_expired
--   auto-complete → contracted_services_executed_auto_complete_idx

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- Index presence + validity
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'service_request_enrichments'
      and indexname = 'idx_enrichments_claim_due'
  ),
  'idx_enrichments_claim_due exists'
);

select ok(
  (
    select position('ops_attention_at' in pg_get_indexdef(i.indexrelid)) > 0
      and position('PENDING' in pg_get_indexdef(i.indexrelid)) > 0
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'public'
      and t.relname = 'service_request_enrichments'
      and ix.relname = 'idx_enrichments_claim_due'
  ),
  'idx_enrichments_claim_due is partial PENDING AND ops_attention_at IS NULL'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'service_request_enrichments'
      and indexname = 'idx_enrichments_lease_expired'
  )
  and (
    select i.indisvalid
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'public'
      and t.relname = 'service_request_enrichments'
      and ix.relname = 'idx_enrichments_lease_expired'
  ),
  'idx_enrichments_lease_expired exists and is valid'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'contracted_services'
      and indexname = 'contracted_services_executed_auto_complete_idx'
  )
  and (
    select position('EXECUTED' in pg_get_indexdef(i.indexrelid)) > 0
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'public'
      and t.relname = 'contracted_services'
      and ix.relname = 'contracted_services_executed_auto_complete_idx'
  ),
  'contracted_services_executed_auto_complete_idx exists (EXECUTED partial)'
);

-- ---------------------------------------------------------------------------
-- Seed rows so planner prefers index scans
-- ---------------------------------------------------------------------------

create temp table _idx_fx as
select
  gen_random_uuid() as sr_claim,
  gen_random_uuid() as enr_claim,
  gen_random_uuid() as sr_reclaim,
  gen_random_uuid() as enr_reclaim,
  gen_random_uuid() as sr_cs,
  gen_random_uuid() as prop_cs,
  gen_random_uuid() as cs_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('index explain %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_claim as sr_id, 'claim' as label from _idx_fx
  union all select sr_reclaim, 'reclaim' from _idx_fx
  union all select sr_cs, 'cs' from _idx_fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at
)
select enr_claim, sr_claim, 'PENDING'::public.enrichment_status, 0, null
from _idx_fx;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_reclaim, sr_reclaim, 'RUNNING'::public.enrichment_status, 1,
  'worker-explain', 1, now() - interval '5 minutes'
from _idx_fx;

do $seed_cs$
declare
  v_client_id uuid;
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date - 3, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
begin
  select sr.client_id into v_client_id
  from public.service_requests sr
  where sr.id = (select sr_cs from _idx_fx);

  perform set_config('request.jwt.claim.sub', (select provider_id from _idx_fx)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    prop_cs, provider_id, sr_cs, v_pricing.original_amount,
    'index explain proposal', 1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _idx_fx;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    cs_id, sr_cs, prop_cs, v_client_id, provider_id,
    'days', 1, current_date - 3, current_date - 3, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '48 hours'
  from _idx_fx;

  -- Deferred trigger: EXECUTED requires frozen evidence in the same TX
  insert into public.contracted_service_completion_evidence (
    contracted_service_id, phase, frozen_at, responses_hash,
    responses, idempotency_key
  )
  select
    cs_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '48 hours',
    'idx-seed-hash',
    '{"crit_work_done":{"met":true},"crit_area_clean":{"met":true},"crit_client_access":{"met":true}}'::jsonb,
    'seed-idx-autocomplete'
  from _idx_fx;
end;
$seed_cs$;

-- ---------------------------------------------------------------------------
-- EXPLAIN helpers (mirror claim / reclaim / auto-complete predicates)
-- ---------------------------------------------------------------------------

create or replace function pg_temp.explain_uses_index(p_sql text, p_index_name text)
returns boolean
language plpgsql
as $$
declare
  r record;
begin
  execute 'set local enable_seqscan = off';
  for r in execute 'explain (analyze false, format text) ' || p_sql
  loop
    if position(p_index_name in r."QUERY PLAN") > 0 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

select ok(
  pg_temp.explain_uses_index(
    $sql$
      select e.id
      from public.service_request_enrichments e
      where e.status = 'PENDING'::public.enrichment_status
        and e.ops_attention_at is null
        and (e.next_attempt_at is null or e.next_attempt_at <= now())
      order by e.next_attempt_at nulls first, e.created_at
      limit 20
    $sql$,
    'idx_enrichments_claim_due'
  ),
  'EXPLAIN claim-due predicate uses idx_enrichments_claim_due'
);

select ok(
  pg_temp.explain_uses_index(
    $sql$
      select e.id
      from public.service_request_enrichments e
      where e.status = 'RUNNING'::public.enrichment_status
        and e.locked_until is not null
        and e.locked_until < now()
      order by e.locked_until
      limit 20
    $sql$,
    'idx_enrichments_lease_expired'
  ),
  'EXPLAIN lease-expired predicate uses idx_enrichments_lease_expired'
);

select ok(
  pg_temp.explain_uses_index(
    $sql$
      select cs.id
      from public.contracted_services cs
      where cs.status = 'EXECUTED'::public.contracted_service_status
        and cs.executed_at is not null
        and cs.executed_at + interval '24 hours' <= now()
      order by cs.executed_at
      limit 20
    $sql$,
    'contracted_services_executed_auto_complete_idx'
  ),
  'EXPLAIN auto-complete predicate uses contracted_services_executed_auto_complete_idx'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'service_request_enrichments'
      and indexname = 'idx_enrichments_ready'
  ),
  'idx_enrichments_ready exists for READY repair'
);

select is(
  (
    select count(*)::int
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'idx_enrichments_claim_due',
        'idx_enrichments_lease_expired',
        'idx_enrichments_ready',
        'contracted_services_executed_auto_complete_idx'
      )
  ),
  4,
  'all four Task 63 scale indexes are present'
);

select * from finish();

rollback;
