-- pgTAP: Task 67 — Cancel vs READY race (design §4.1.2 / §7.1 / Req 7).
-- Sequential ordering simulates concurrency winners: cancel-first vs READY-first;
-- delayed finalize after abort is a NO-OP.

begin;

select plan(15);

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

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create temp table _fx as
select
  -- A: cancel wins (RUNNING)
  gen_random_uuid() as sr_cancel,
  gen_random_uuid() as enr_cancel,
  -- B: READY wins then published cancel
  gen_random_uuid() as sr_ready,
  gen_random_uuid() as enr_ready,
  -- C: delayed finalize after PENDING abort
  gen_random_uuid() as sr_delayed,
  gen_random_uuid() as enr_delayed,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id;

create temp table _schema as
select checklist_schema as schema
from public.completion_checklist_templates
where is_global and is_active
limit 1;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('cancel vs ready %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_cancel as sr_id, 'cancel_wins' as label from _fx
  union all select sr_ready, 'ready_wins' from _fx
  union all select sr_delayed, 'delayed_fin' from _fx
) x
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- RUNNING enrichments for cancel-wins and ready-wins
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_cancel, sr_cancel, 'RUNNING'::public.enrichment_status, 0,
  'worker-cancel-race', 3, now() + interval '5 minutes'
from _fx
union all
select
  enr_ready, sr_ready, 'RUNNING'::public.enrichment_status, 0,
  'worker-ready-race', 1, now() + interval '5 minutes'
from _fx;

-- PENDING for delayed-finalize-after-abort
insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count
)
select enr_delayed, sr_delayed, 'PENDING'::public.enrichment_status, 0
from _fx;

-- ---------------------------------------------------------------------------
-- A. Cancel wins: ABORTED, no schema, no dispatch; delayed finalize NO-OP
-- ---------------------------------------------------------------------------

select pg_temp.cns_set_auth((select client_id from _fx));

select lives_ok(
  $sql$
    select public.cancel_service_request(
      (select sr_cancel from _fx),
      gen_random_uuid()
    )
  $sql$,
  'cancel wins: cancel_service_request on RUNNING enrichment succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_cancel
    where e.status = 'ABORTED'::public.enrichment_status
      and e.checklist_schema is null
      and e.source is null
      and e.lease_owner is null
  ),
  '7.1/7.2 cancel wins → ABORTED with no schema and lease cleared'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_cancel
  ),
  0,
  '7.3 cancel wins → no matching dispatch bootstrap'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_cancel
    where ev.event_type = 'ABORTED'
      and ev.from_status = 'RUNNING'::public.enrichment_status
  ),
  '7.5 cancel wins appends ABORTED audit event'
);

select pg_temp.set_service_role();

select is(
  public.enrichment_finalize_ready(
    (select enr_cancel from _fx),
    'worker-cancel-race',
    3,
    (select schema from _schema),
    'ai'::public.checklist_source,
    null
  )->>'reason',
  'ABORTED',
  '7.2 delayed finalize after cancel is NO-OP (ABORTED)'
);

select ok(
  (
    select e.checklist_schema is null
      and e.status = 'ABORTED'::public.enrichment_status
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_cancel
  )
  and (
    select count(*)::int
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_cancel
  ) = 0,
  'delayed finalize does not materialize schema or bootstrap'
);

-- ---------------------------------------------------------------------------
-- B. READY wins: schema+dispatch, then cancel follows published path
-- ---------------------------------------------------------------------------

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_ready from _fx),
      'worker-ready-race',
      1,
      (select schema from _schema),
      'ai'::public.checklist_source,
      null
    )->>'ok')::boolean
  ),
  'READY wins: finalize succeeds first'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_ready
    where e.status = 'READY'::public.enrichment_status
      and e.checklist_schema is not null
  )
  and exists (
    select 1
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_ready
    where d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
  ),
  '2.6/7.4 READY wins → schema + DISPATCH_PENDING'
);

create temp table _ready_schema as
select e.checklist_schema, e.source
from public.service_request_enrichments e
join _fx f on e.id = f.enr_ready;

select pg_temp.cns_set_auth((select client_id from _fx));

select lives_ok(
  $sql$
    select public.cancel_service_request(
      (select sr_ready from _fx),
      gen_random_uuid()
    )
  $sql$,
  'READY-first: cancel_service_request still succeeds on OPEN SR'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_ready
    where e.status = 'READY'::public.enrichment_status
      and e.checklist_schema = (select checklist_schema from _ready_schema)
      and e.source = (select source from _ready_schema)
  ),
  '7.4 READY-first cancel does not abort enrichment or clear schema'
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_ready
  ),
  'DISPATCH_CANCELLED',
  '7.4 READY-first cancel follows published path (DISPATCH_CANCELLED)'
);

-- ---------------------------------------------------------------------------
-- C. PENDING abort then delayed finalize NO-OP
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.cancel_service_request(
      (select sr_delayed from _fx),
      gen_random_uuid()
    )
  $sql$,
  'cancel PENDING enrichment succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    join _fx f on e.id = f.enr_delayed
    where e.status = 'ABORTED'::public.enrichment_status
      and e.checklist_schema is null
  )
  and exists (
    select 1
    from public.service_request_enrichment_events ev
    join _fx f on ev.enrichment_id = f.enr_delayed
    where ev.event_type = 'ABORTED'
      and ev.from_status = 'PENDING'::public.enrichment_status
  ),
  'PENDING→ABORTED on cancel; ABORTED event from PENDING'
);

select pg_temp.set_service_role();

-- Simulate stale worker that still holds a fabricated lease (enrichment already ABORTED)
select is(
  public.enrichment_finalize_ready(
    (select enr_delayed from _fx),
    'worker-stale-after-abort',
    99,
    (select schema from _schema),
    'fallback_template'::public.checklist_source,
    null
  )->>'reason',
  'ABORTED',
  'delayed finalize after PENDING abort returns ABORTED (NO-OP)'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    join _fx f on d.service_request_id = f.sr_delayed
  ),
  0,
  'no dispatch after abort + delayed finalize'
);

select * from finish();

rollback;
