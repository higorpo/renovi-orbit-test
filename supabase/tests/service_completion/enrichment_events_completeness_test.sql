-- pgTAP: Task 54 — every enrichment transition appends an event with
-- actor, from/to, lease_generation, correlation_id, and payload.

begin;

select plan(13);

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

create or replace function pg_temp.event_shape_ok(
  p_enrichment_id uuid,
  p_event_type text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.service_request_enrichment_events ev
    where ev.enrichment_id = p_enrichment_id
      and ev.event_type = p_event_type
      and nullif(btrim(ev.actor), '') is not null
      and ev.to_status is not null
      and ev.lease_generation is not null
      and ev.correlation_id is not null
      and ev.payload ? 'lease_generation'
      and jsonb_typeof(ev.payload) = 'object'
  );
$$;

create temp table _fx as
select
  gen_random_uuid() as corr,
  gen_random_uuid() as sr_enq,
  gen_random_uuid() as sr_claim,
  gen_random_uuid() as sr_retry,
  gen_random_uuid() as sr_ready,
  gen_random_uuid() as sr_fb,
  gen_random_uuid() as sr_abort,
  gen_random_uuid() as sr_reclaim,
  gen_random_uuid() as sr_ops,
  gen_random_uuid() as enr_claim,
  gen_random_uuid() as enr_retry,
  gen_random_uuid() as enr_ready,
  gen_random_uuid() as enr_fb,
  gen_random_uuid() as enr_abort,
  gen_random_uuid() as enr_reclaim,
  gen_random_uuid() as enr_ops;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('events completeness %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_enq as sr_id, 'enq' as label from _fx
  union all select sr_claim, 'claim' from _fx
  union all select sr_retry, 'retry' from _fx
  union all select sr_ready, 'ready' from _fx
  union all select sr_fb, 'fb' from _fx
  union all select sr_abort, 'abort' from _fx
  union all select sr_reclaim, 'reclaim' from _fx
  union all select sr_ops, 'ops' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- ENQUEUED
select public.service_request_enqueue_enrichment(
  (select sr_enq from _fx),
  (select corr from _fx)
);

select ok(
  (
    select pg_temp.event_shape_ok(e.id, 'ENQUEUED')
    from public.service_request_enrichments e
    where e.service_request_id = (select sr_enq from _fx)
  ),
  'ENQUEUED event has actor/from-to/lease_generation/correlation_id/payload'
);

select is(
  (
    select ev.from_status::text
    from public.service_request_enrichment_events ev
    join public.service_request_enrichments e on e.id = ev.enrichment_id
    where e.service_request_id = (select sr_enq from _fx)
      and ev.event_type = 'ENQUEUED'
  ),
  null,
  'ENQUEUED from_status is null (birth transition)'
);

select pg_temp.set_service_role();

-- CLAIMED
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, correlation_id
)
select enr_claim, sr_claim, 'PENDING', 0, corr from _fx;

select public.enrichment_claim_batch('worker-events', 10);

select ok(
  pg_temp.event_shape_ok((select enr_claim from _fx), 'CLAIMED'),
  'CLAIMED event shape complete'
);

select is(
  (
    select ev.from_status::text || '→' || ev.to_status::text
    from public.service_request_enrichment_events ev
    where ev.enrichment_id = (select enr_claim from _fx)
      and ev.event_type = 'CLAIMED'
  ),
  'PENDING→RUNNING',
  'CLAIMED records PENDING→RUNNING'
);

-- RETRY
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until, correlation_id
)
select
  enr_retry, sr_retry, 'RUNNING', 0,
  'worker-retry', 2, now() + interval '2 minutes', corr
from _fx;

select public.enrichment_schedule_retry(
  (select enr_retry from _fx),
  'worker-retry',
  2,
  'LLM_TRANSIENT',
  'timeout'
);

select ok(
  pg_temp.event_shape_ok((select enr_retry from _fx), 'RETRY'),
  'RETRY event shape complete'
);

-- READY (ai)
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until, correlation_id
)
select
  enr_ready, sr_ready, 'RUNNING', 0,
  'worker-ready', 4, now() + interval '2 minutes', corr
from _fx;

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_ready from _fx),
      'worker-ready',
      4,
      (
        select checklist_schema
        from public.completion_checklist_templates
        where is_global and is_active
        limit 1
      ),
      'ai'::public.checklist_source,
      (select corr from _fx)
    )->>'ok')::boolean
  ),
  'finalize READY succeeds'
);

select ok(
  pg_temp.event_shape_ok((select enr_ready from _fx), 'READY'),
  'READY event shape complete'
);

-- FALLBACK_APPLIED
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until, correlation_id
)
select
  enr_fb, sr_fb, 'RUNNING', 3,
  'worker-fb', 5, now() + interval '2 minutes', corr
from _fx;

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_fb from _fx),
      'worker-fb',
      5,
      (
        select checklist_schema
        from public.completion_checklist_templates
        where is_global and is_active
        limit 1
      ),
      'fallback_template'::public.checklist_source,
      (select corr from _fx)
    )->>'ok')::boolean
  ),
  'finalize FALLBACK succeeds'
);

select ok(
  pg_temp.event_shape_ok((select enr_fb from _fx), 'FALLBACK_APPLIED'),
  'FALLBACK_APPLIED event shape complete'
);

-- ABORTED
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, correlation_id
)
select enr_abort, sr_abort, 'PENDING', 0, corr from _fx;

select public.enrichment_abort_for_service_request(
  (select sr_abort from _fx),
  'test_abort',
  (select corr from _fx),
  '{}'::jsonb
);

select ok(
  pg_temp.event_shape_ok((select enr_abort from _fx), 'ABORTED'),
  'ABORTED event shape complete'
);

-- RECLAIM
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until, correlation_id
)
select
  enr_reclaim, sr_reclaim, 'RUNNING', 0,
  'worker-stale', 1, now() - interval '1 minute', corr
from _fx;

select public.enrichment_reclaim_expired_leases(10);

select ok(
  pg_temp.event_shape_ok((select enr_reclaim from _fx), 'RECLAIM'),
  'RECLAIM event shape complete'
);

-- OPS_ATTENTION
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until, correlation_id
)
select
  enr_ops, sr_ops, 'RUNNING', 0,
  'worker-ops', 7, now() + interval '2 minutes', corr
from _fx;

select public.enrichment_mark_ops_attention(
  (select enr_ops from _fx),
  'TEST_OPS',
  'worker-ops',
  7,
  (select corr from _fx),
  jsonb_build_object('detail', 'task54')
);

select ok(
  pg_temp.event_shape_ok((select enr_ops from _fx), 'OPS_ATTENTION'),
  'OPS_ATTENTION event shape complete'
);

select ok(
  (
    select count(distinct ev.event_type) >= 8
    from public.service_request_enrichment_events ev
    where ev.correlation_id = (select corr from _fx)
  ),
  'correlation_id links the forensic timeline across transition types'
);

select finish();

rollback;
