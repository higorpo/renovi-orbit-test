-- pgTAP: Task 65 — Enrichment FSM legal transitions (design §2.3 / Req 25).
-- Covers PENDING→RUNNING→READY; RUNNING→PENDING retry; ABORT from PENDING/RUNNING;
-- READY/ABORTED terminal; schema immutability after READY; event appends.

begin;

select plan(19);

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
  -- Happy path: claim → retry → claim → ready
  gen_random_uuid() as sr_happy,
  gen_random_uuid() as enr_happy,
  -- PENDING abort
  gen_random_uuid() as sr_abort_p,
  gen_random_uuid() as enr_abort_p,
  -- RUNNING abort
  gen_random_uuid() as sr_abort_r,
  gen_random_uuid() as enr_abort_r,
  -- Illegal finalize from PENDING
  gen_random_uuid() as sr_illegal,
  gen_random_uuid() as enr_illegal;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, sr.client_id, sr.service_id, sr.address_id,
  format('fsm legal %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from (
  select sr_happy as sr_id, 'happy' as label from _fx
  union all select sr_abort_p, 'abort_p' from _fx
  union all select sr_abort_r, 'abort_r' from _fx
  union all select sr_illegal, 'illegal' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, next_attempt_at,
  lease_owner, lease_generation, locked_until
)
select
  enr_happy, sr_happy, 'PENDING'::public.enrichment_status, 0,
  null::timestamptz, null::text, 0, null::timestamptz
from _fx
union all
select
  enr_abort_p, sr_abort_p, 'PENDING'::public.enrichment_status, 0,
  now() + interval '7 days', null::text, 0, null::timestamptz
from _fx
union all
select
  enr_abort_r, sr_abort_r, 'RUNNING'::public.enrichment_status, 0,
  null::timestamptz, 'worker-abort-r', 1, now() + interval '2 minutes'
from _fx
union all
select
  enr_illegal, sr_illegal, 'PENDING'::public.enrichment_status, 0,
  now() + interval '7 days', null::text, 0, null::timestamptz
from _fx;

select pg_temp.set_service_role();

-- ---------------------------------------------------------------------------
-- PENDING → RUNNING (claim) + CLAIMED event
-- ---------------------------------------------------------------------------

create temp table _claim1 as
select public.enrichment_claim_batch('worker-fsm', 1) as payload;

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
    where e.status = 'RUNNING'::public.enrichment_status
      and e.lease_owner = 'worker-fsm'
      and e.lease_generation = 1
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_happy
    where ev.event_type = 'CLAIMED'
      and ev.to_status = 'RUNNING'::public.enrichment_status
      and ev.from_status = 'PENDING'::public.enrichment_status
  ),
  '25.1 PENDING→RUNNING via claim; CLAIMED event appended'
);

-- ---------------------------------------------------------------------------
-- RUNNING → PENDING (retry) + RETRY event
-- ---------------------------------------------------------------------------

create temp table _retry1 as
select public.enrichment_schedule_retry(
  (select enr_happy from _fx),
  'worker-fsm',
  1,
  'LLM_TRANSIENT',
  'timeout'
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _retry1)
  and exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
    where e.status = 'PENDING'::public.enrichment_status
      and e.attempt_count = 1
      and e.lease_owner is null
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_happy
    where ev.event_type = 'RETRY'
      and ev.to_status = 'PENDING'::public.enrichment_status
      and ev.from_status = 'RUNNING'::public.enrichment_status
  ),
  '25.1 RUNNING→PENDING via schedule_retry; RETRY event appended'
);

-- Make due for re-claim (backoff would otherwise block)
update public.service_request_enrichments e
set next_attempt_at = null
from _fx f
where e.id = f.enr_happy;

create temp table _claim2 as
select public.enrichment_claim_batch('worker-fsm', 1) as payload;

select is(
  (
    select e.lease_generation
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
  ),
  2::bigint,
  're-claim after retry bumps lease_generation'
);

-- ---------------------------------------------------------------------------
-- RUNNING → READY (finalize) + READY event + schema immutability
-- ---------------------------------------------------------------------------

create temp table _schema as
select checklist_schema as schema
from public.completion_checklist_templates
where is_global and is_active
limit 1;

create temp table _fin1 as
select public.enrichment_finalize_ready(
  (select enr_happy from _fx),
  'worker-fsm',
  2,
  (select schema from _schema),
  'ai'::public.checklist_source,
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _fin1)
  and exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
    where e.status = 'READY'::public.enrichment_status
      and e.checklist_schema is not null
      and e.source = 'ai'::public.checklist_source
      and e.lease_owner is null
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_happy
    where ev.event_type = 'READY'
      and ev.to_status = 'READY'::public.enrichment_status
      and ev.from_status = 'RUNNING'::public.enrichment_status
  ),
  '25.1 RUNNING→READY via finalize; READY event appended'
);

-- Capture schema hash for immutability check
create temp table _ready_schema as
select e.checklist_schema, e.materialized_at
from public.service_request_enrichments e
join _fx f on e.id = f.enr_happy;

create temp table _fin_idem as
select public.enrichment_finalize_ready(
  (select enr_happy from _fx),
  'worker-fsm',
  2,
  -- Different payload would be ignored on idempotent READY path
  (select schema from _schema),
  'fallback_template'::public.checklist_source,
  null
) as payload;

select ok(
  (select (payload->>'ok')::boolean and (payload->>'idempotent')::boolean from _fin_idem)
  and (
    select e.checklist_schema
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
  ) = (select checklist_schema from _ready_schema)
  and (
    select e.source
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
  ) = 'ai'::public.checklist_source
  and (
    select e.materialized_at
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
  ) = (select materialized_at from _ready_schema),
  '25.4 READY terminal: finalize idempotent; schema/source immutable'
);

-- ---------------------------------------------------------------------------
-- READY terminal: abort no-op; claim skip; retry reject
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.enrichment_abort_for_service_request(
      (select sr_happy from _fx),
      'fsm_test',
      null,
      '{}'::jsonb
    )
  $sql$,
  'abort on READY does not raise'
);

select is(
  (
    select e.status::text
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_happy
  ),
  'READY',
  '25.3 READY terminal: abort leaves READY unchanged'
);

select is(
  public.enrichment_schedule_retry(
    (select enr_happy from _fx),
    'worker-fsm',
    2,
    'X',
    'Y'
  )->>'reason',
  'STALE_LEASE_OR_STATE',
  'illegal READY→PENDING via retry rejected'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.enrichment_claim_batch('worker-fsm', 50)) elem
    join _fx f on (elem->>'id')::uuid = f.enr_happy
  ),
  'READY enrichment is not claimable'
);

-- ---------------------------------------------------------------------------
-- PENDING → ABORTED + event
-- ---------------------------------------------------------------------------

-- PENDING abort fixture must be due-claimable only after we abort it (not claimed earlier)
update public.service_request_enrichments e
set next_attempt_at = null
from _fx f
where e.id = f.enr_abort_p;

select lives_ok(
  $sql$
    select public.enrichment_abort_for_service_request(
      (select sr_abort_p from _fx),
      'fsm_test_pending',
      null,
      '{}'::jsonb
    )
  $sql$,
  'abort PENDING succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_abort_p
    where e.status = 'ABORTED'::public.enrichment_status
      and e.checklist_schema is null
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_abort_p
    where ev.event_type = 'ABORTED'
      and ev.from_status = 'PENDING'::public.enrichment_status
      and ev.to_status = 'ABORTED'::public.enrichment_status
  ),
  '25.1 PENDING→ABORTED; ABORTED event appended'
);

-- ---------------------------------------------------------------------------
-- RUNNING → ABORTED + event
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.enrichment_abort_for_service_request(
      (select sr_abort_r from _fx),
      'fsm_test_running',
      null,
      '{}'::jsonb
    )
  $sql$,
  'abort RUNNING succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_abort_r
    where e.status = 'ABORTED'::public.enrichment_status
      and e.lease_owner is null
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_abort_r
    where ev.event_type = 'ABORTED'
      and ev.from_status = 'RUNNING'::public.enrichment_status
  ),
  '25.1 RUNNING→ABORTED; ABORTED event appended'
);

-- ABORTED terminal: second abort idempotent; finalize rejects; claim skips
select lives_ok(
  $sql$
    select public.enrichment_abort_for_service_request(
      (select sr_abort_p from _fx),
      'fsm_test_pending_again',
      null,
      '{}'::jsonb
    )
  $sql$,
  'abort on ABORTED is idempotent no-op'
);

select is(
  (
    select count(*)::int
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_abort_p
    where ev.event_type = 'ABORTED'
  ),
  1,
  '25.3 ABORTED terminal: second abort does not append another ABORTED event'
);

select is(
  public.enrichment_finalize_ready(
    (select enr_abort_p from _fx),
    'worker-fsm',
    1,
    (select schema from _schema),
    'ai'::public.checklist_source,
    null
  )->>'reason',
  'ABORTED',
  'illegal ABORTED→READY via finalize rejected'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.enrichment_claim_batch('worker-fsm', 50)) elem
    join _fx f on (elem->>'id')::uuid in (f.enr_abort_p, f.enr_abort_r)
  ),
  'ABORTED enrichments are not claimable'
);

-- ---------------------------------------------------------------------------
-- Illegal: finalize PENDING without RUNNING lease
-- ---------------------------------------------------------------------------

select is(
  public.enrichment_finalize_ready(
    (select enr_illegal from _fx),
    'worker-fsm',
    1,
    (select schema from _schema),
    'fallback_template'::public.checklist_source,
    null
  )->>'reason',
  'STALE_LEASE_OR_STATE',
  'illegal PENDING→READY without claim/lease rejected (STALE_LEASE_OR_STATE)'
);

select is(
  (
    select e.status::text
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_illegal
  ),
  'PENDING',
  'illegal finalize leaves PENDING unchanged'
);

select * from finish();

rollback;
