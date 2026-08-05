-- pgTAP: Task 59 — design §8.1 failure matrix (SQL recovery paths).
-- Test names document expected outcomes for CI/ops.

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

create temp table _fx as
select
  gen_random_uuid() as sr_reclaim,
  gen_random_uuid() as enr_reclaim,
  gen_random_uuid() as sr_repair,
  gen_random_uuid() as enr_repair,
  gen_random_uuid() as sr_pending,
  gen_random_uuid() as enr_pending,
  gen_random_uuid() as sr_ops,
  gen_random_uuid() as enr_ops,
  gen_random_uuid() as sr_ready_idem,
  gen_random_uuid() as enr_ready_idem,
  gen_random_uuid() as sr_retry,
  gen_random_uuid() as enr_retry;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('failure matrix %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_reclaim as sr_id, 'reclaim' as label from _fx
  union all select sr_repair, 'repair' from _fx
  union all select sr_pending, 'pending' from _fx
  union all select sr_ops, 'ops' from _fx
  union all select sr_ready_idem, 'ready_idem' from _fx
  union all select sr_retry, 'retry' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- Lease expired mid-LLM → reclaim; stale finalize no-op
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_reclaim, sr_reclaim, 'RUNNING'::public.enrichment_status, 1,
  'worker-stale', 4, now() - interval '2 minutes'
from _fx;

select pg_temp.set_service_role();

select is(
  (public.enrichment_reclaim_expired_leases(10)->>'reclaimed_count')::int,
  1,
  '§8.1 lease expired: reclaim returns reclaimed_count=1'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_reclaim
    where e.status = 'PENDING'::public.enrichment_status
      and e.lease_owner is null
      and e.lease_generation = 5
  ),
  '§8.1 lease expired: row PENDING with lease_generation incremented'
);

-- Keep reclaimed row out of due claim window for later ops_attention assertions.
update public.service_request_enrichments
set next_attempt_at = now() + interval '1 day'
where id = (select enr_reclaim from _fx);

select is(
  public.enrichment_finalize_ready(
    (select enr_reclaim from _fx),
    'worker-stale',
    4,
    (
      select checklist_schema
      from public.completion_checklist_templates
      where is_global and is_active
      limit 1
    ),
    'ai'::public.checklist_source,
    null
  )->>'reason',
  'STALE_LEASE_OR_STATE',
  '§8.1 lease expired: stale finalize rejected (STALE_LEASE_OR_STATE)'
);

-- READY without dispatch → sweeper bootstrap repair (schema unchanged)
insert into public.service_request_enrichments (
  id, service_request_id, status, checklist_schema, source, materialized_at
)
select
  enr_repair,
  sr_repair,
  'READY'::public.enrichment_status,
  (select checklist_schema from public.completion_checklist_templates where is_global and is_active limit 1),
  'ai'::public.checklist_source,
  now()
from _fx;

select is(
  (public.enrichment_repair_ready_without_dispatch(10)->>'repaired_count')::int,
  1,
  '§8.1 READY without dispatch: repair returns repaired_count=1'
);

select ok(
  exists (
    select 1
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_repair
  ),
  '§8.1 READY without dispatch: matching dispatch bootstrapped'
);

select ok(
  (
    select e.checklist_schema is not null
      and e.source = 'ai'::public.checklist_source
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_repair
  ),
  '§8.1 READY without dispatch: schema NOT regenerated (source/schema preserved)'
);

-- Template missing / ops hold → claim skips (non-READY terminal ops)
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_ops, sr_ops, 'RUNNING'::public.enrichment_status, 3,
  'worker-ops', 1, now() + interval '2 minutes'
from _fx;

select ok(
  (
    select (public.enrichment_mark_ops_attention(
      (select enr_ops from _fx),
      'TEMPLATE_CASCADE_MISSING',
      'worker-ops',
      1,
      null,
      '{}'::jsonb
    )->>'ok')::boolean
  ),
  '§8.1 template missing: mark_ops_attention succeeds'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.enrichment_claim_batch('worker-claim-ops', 20)) elem
    where elem->>'id' = (select enr_ops::text from _fx)
  ),
  '§8.1 template missing: claim_batch skips ops_attention PENDING'
);

-- Worker crash after READY: idempotent finalize no-op
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until,
  checklist_schema, source, materialized_at
)
select
  enr_ready_idem,
  sr_ready_idem,
  'READY'::public.enrichment_status,
  0,
  null,
  2,
  null,
  (select checklist_schema from public.completion_checklist_templates where is_global and is_active limit 1),
  'ai'::public.checklist_source,
  now()
from _fx;

select public.matching_bootstrap_dispatch_for_service_request(
  (select sr_ready_idem from _fx)
);

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_ready_idem from _fx),
      'any-worker',
      99,
      (
        select checklist_schema
        from public.completion_checklist_templates
        where is_global and is_active
        limit 1
      ),
      'ai'::public.checklist_source,
      null
    )->>'idempotent')::boolean
  ),
  '§8.1 worker crash after READY: finalize is idempotent READY no-op'
);

-- Wake failure recovered by cron: due PENDING remains durable for next tick
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at
)
select
  enr_pending, sr_pending, 'PENDING'::public.enrichment_status, 0, null
from _fx;

create temp table _sweep as
select public.enrichment_cron_sweep() as payload;

select ok(
  (select (payload->>'due_pending_count')::int >= 1 from _sweep),
  '§8.1 Edge wake failure recovery: cron_sweep still sees due PENDING (>=1)'
);

select ok(
  (select payload ? 'reclaim_count' and payload ? 'repair_count' from _sweep),
  '§8.1 cron safety net: sweep returns reclaim_count + repair_count telemetry'
);

-- Invalid → retry backoff
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_retry, sr_retry, 'RUNNING'::public.enrichment_status, 0,
  'worker-retry', 1, now() + interval '2 minutes'
from _fx;

select ok(
  (
    select (public.enrichment_schedule_retry(
      (select enr_retry from _fx),
      'worker-retry',
      1,
      'INVALID_CHECKLIST_SCHEMA',
      'validation'
    )->>'ok')::boolean
  ),
  '§8.1 invalid schema/validation: schedule_retry succeeds (transient → backoff)'
);

select finish();

rollback;
