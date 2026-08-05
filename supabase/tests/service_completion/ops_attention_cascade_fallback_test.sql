-- pgTAP: Task 71 — ops_attention skip + template cascade fallback recovery
-- (Req 5 AC1–5 / 22.6–22.7). Missing/invalid cascade → ops hold (non-READY);
-- seed + clear_ops_attention → fallback_template READY.

begin;

select plan(12);

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

-- Snapshot a known-valid schema before deactivating templates.
create temp table _valid_schema as
select checklist_schema
from public.completion_checklist_templates
where is_global and is_active
limit 1;

create temp table _fx as
select
  gen_random_uuid() as sr_missing,
  gen_random_uuid() as enr_missing,
  gen_random_uuid() as sr_invalid,
  gen_random_uuid() as enr_invalid,
  gen_random_uuid() as recovery_tpl_id,
  gen_random_uuid() as invalid_tpl_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('ops cascade %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_missing as sr_id, 'missing' as label from _fx
  union all
  select sr_invalid, 'invalid' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- Simulate exhausted AI attempts mid-lease (worker about to fallback).
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_missing, sr_missing, 'RUNNING'::public.enrichment_status, 3,
  'worker-cascade', 1, now() + interval '2 minutes'
from _fx;

select pg_temp.set_service_role();

-- ---------------------------------------------------------------------------
-- Missing templates at all cascade levels → ops_attention, claim skip, no READY
-- ---------------------------------------------------------------------------

update public.completion_checklist_templates
set is_active = false
where is_active;

select ok(
  public.resolve_completion_checklist_template(
    (select service_id from public.service_requests where id = (select sr_missing from _fx)),
    null
  ) is null,
  '5.4 cascade returns null when no active templates'
);

select ok(
  (
    select (public.enrichment_mark_ops_attention(
      (select enr_missing from _fx),
      'TEMPLATE_CASCADE_MISSING',
      'worker-cascade',
      1,
      null,
      jsonb_build_object('attempt_count', 3, 'had_template', false)
    )->>'ok')::boolean
  ),
  '5.4 mark_ops_attention after missing cascade'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_missing
    where e.status = 'PENDING'::public.enrichment_status
      and e.ops_attention_at is not null
      and e.checklist_schema is null
      and e.next_attempt_at is null
  )
  and not exists (
    select 1
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_missing
  )
  and not exists (
    select 1
    from jsonb_array_elements(public.enrichment_claim_batch('worker-skip-ops', 50)) elem
    join _fx f on (elem->>'id')::uuid = f.enr_missing
  ),
  '5.4/22.6 ops hold: PENDING non-READY, no dispatch, claim skips row'
);

-- ---------------------------------------------------------------------------
-- Seed valid template + clear_ops_attention → claim → fallback READY
-- ---------------------------------------------------------------------------

insert into public.completion_checklist_templates (
  id, is_global, is_active, schema_version, checklist_schema
)
select
  recovery_tpl_id, true, true, 1, (select checklist_schema from _valid_schema)
from _fx;

select ok(
  public.resolve_completion_checklist_template(
    (select service_id from public.service_requests where id = (select sr_missing from _fx)),
    null
  )->>'scope' = 'global',
  '5.1 cascade resolves seeded global template'
);

select is(
  public.enrichment_clear_ops_attention(
    (select enr_missing from _fx),
    true,
    'ops_seed',
    null,
    '{}'::jsonb
  )->>'ok',
  'true',
  '22.7 clear_ops_attention after template seed'
);

-- Park other due PENDING so claim focuses on fixture (TX rolls back).
update public.service_request_enrichments
set next_attempt_at = now() + interval '1 day'
where status = 'PENDING'::public.enrichment_status
  and ops_attention_at is null
  and id <> (select enr_missing from _fx);

create temp table _claim_recovery as
select public.enrichment_claim_batch('worker-recovery', 5) as payload;

select ok(
  exists (
    select 1
    from jsonb_array_elements((select payload from _claim_recovery)) elem
    join _fx f on (elem->>'id')::uuid = f.enr_missing
  ),
  '22.7 row claimable after clear_ops_attention'
);

create temp table _claimed_row as
select
  (elem->>'lease_owner') as lease_owner,
  (elem->>'lease_generation')::bigint as lease_generation
from jsonb_array_elements((select payload from _claim_recovery)) elem
join _fx f on (elem->>'id')::uuid = f.enr_missing
limit 1;

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_missing from _fx),
      (select lease_owner from _claimed_row),
      (select lease_generation from _claimed_row),
      (select checklist_schema from _valid_schema),
      'fallback_template'::public.checklist_source,
      null
    )->>'ok')::boolean
  ),
  '5.1/5.2 finalize fallback_template succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_missing
    where e.status = 'READY'::public.enrichment_status
      and e.source = 'fallback_template'::public.checklist_source
      and e.checklist_schema is not null
      and e.ops_attention_at is null
  )
  and exists (
    select 1
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_missing
  ),
  '5.2 READY with source=fallback_template and matching bootstrap'
);

-- ---------------------------------------------------------------------------
-- Invalid template treated as missing (AC5) → ops_attention, never READY
-- ---------------------------------------------------------------------------

update public.completion_checklist_templates
set is_active = false
where id = (select recovery_tpl_id from _fx);

insert into public.completion_checklist_templates (
  id, is_global, is_active, schema_version, checklist_schema
)
select
  invalid_tpl_id,
  true,
  true,
  1,
  '{"version":1,"blocks":[]}'::jsonb
from _fx;

create temp table _resolved_invalid as
select public.resolve_completion_checklist_template(
  (select service_id from public.service_requests where id = (select sr_invalid from _fx)),
  null
) as payload;

select ok(
  (select payload is not null from _resolved_invalid)
  and not public.enrichment_validate_checklist_schema(
    (select payload->'checklist_schema' from _resolved_invalid)
  ),
  '5.5 resolve finds template but schema fails allowlist/cardinality'
);

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_invalid, sr_invalid, 'RUNNING'::public.enrichment_status, 3,
  'worker-invalid', 1, now() + interval '2 minutes'
from _fx;

-- Worker treats invalid template as null → mark_ops_attention (never finalize).
create temp table _mark_invalid as
select public.enrichment_mark_ops_attention(
  (select enr_invalid from _fx),
  'TEMPLATE_INVALID',
  'worker-invalid',
  1,
  null,
  jsonb_build_object(
    'had_template', true,
    'template_id', (select payload->>'template_id' from _resolved_invalid)
  )
) as payload;

select is(
  (select payload->>'ok' from _mark_invalid),
  'true',
  '5.5 mark_ops_attention succeeds for invalid template path'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_invalid
    where e.status = 'PENDING'::public.enrichment_status
      and e.ops_attention_at is not null
      and e.ops_attention_reason = 'TEMPLATE_INVALID'
      and e.checklist_schema is null
  ),
  '5.5 invalid template → PENDING with ops_attention; schema null'
);

select ok(
  not exists (
    select 1
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_invalid
  )
  and not exists (
    select 1
    from jsonb_array_elements(public.enrichment_claim_batch('worker-skip-invalid', 50)) elem
    join _fx f on (elem->>'id')::uuid = f.enr_invalid
  ),
  '5.5 never READY/dispatch; claim skips ops_attention row'
);

select * from finish();

rollback;
