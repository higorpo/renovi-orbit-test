-- pgTAP: Task 66 — OPEN non-bootstrap, READY handoff delay, conflict preserve,
-- republish fresh PENDING (no schema copy), repair bootstrap (Req 2 / 23).

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

-- ---------------------------------------------------------------------------
-- A. Trigger dropped + OPEN create → PENDING enrichment, zero dispatch
-- ---------------------------------------------------------------------------

select ok(
  not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'service_requests'
      and t.tgname = 'trg_service_request_dispatch_bootstrap'
      and not t.tgisinternal
  ),
  '2.1 trg_service_request_dispatch_bootstrap is dropped'
);

select set_config('test.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('test.address_id', 'acd13138-0d54-431f-a672-55903f31301e', true);
select set_config('test.service_id', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', true);
select set_config('test.idem_key', gen_random_uuid()::text, true);

select lives_ok(
  format(
    $sql$
      select set_config(
        'test.created_sr_id',
        (
          select (public.create_request_quote_service_request(
            '%s'::uuid,
            '%s'::uuid,
            'hash-task66-bootstrap-handoff',
            '%s'::uuid,
            '%s'::uuid,
            'Pedido task66',
            'Descrição task66 open non-bootstrap',
            null,
            '{}'::jsonb,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          )->>'requestId')
        ),
        true
      )
    $sql$,
    current_setting('test.client_id'),
    current_setting('test.idem_key'),
    current_setting('test.address_id'),
    current_setting('test.service_id')
  ),
  'create_request_quote_service_request succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.service_request_id = current_setting('test.created_sr_id')::uuid
      and e.status = 'PENDING'::public.enrichment_status
  )
  and (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = current_setting('test.created_sr_id')::uuid
  ) = 0,
  '2.1/23.1 OPEN create enqueues PENDING enrichment and does not bootstrap dispatch'
);

-- ---------------------------------------------------------------------------
-- B. finalize READY → DISPATCH_PENDING with start delay
-- ---------------------------------------------------------------------------

create temp table _fin as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'task66 finalize handoff', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fin f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  lease_owner, lease_generation, locked_until
)
select
  enr_id, sr_id, 'RUNNING'::public.enrichment_status, 0,
  'worker-task66', 1, now() + interval '2 minutes'
from _fin;

select pg_temp.set_service_role();

create temp table _schema as
select checklist_schema as schema
from public.completion_checklist_templates
where is_global and is_active
limit 1;

select ok(
  (
    select (public.enrichment_finalize_ready(
      (select enr_id from _fin),
      'worker-task66',
      1,
      (select schema from _schema),
      'ai'::public.checklist_source,
      null
    )->>'ok')::boolean
  ),
  'finalize READY succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = (select sr_id from _fin)
      and d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
      and d.next_batch_at > now()
      and d.next_batch_at <= now()
        + make_interval(
          mins => public.platform_constant_int('matching.dispatch_start_delay_minutes', 5) + 1
        )
  ),
  '2.2/2.4 finalize bootstraps DISPATCH_PENDING with next_batch_at delay'
);

create temp table _nb as
select d.next_batch_at
from public.service_request_dispatches d
join _fin f on d.service_request_id = f.sr_id;

-- ---------------------------------------------------------------------------
-- C. conflict / second bootstrap does not reset next_batch_at
-- ---------------------------------------------------------------------------

-- Move next_batch_at forward so a naive reset would be detectable
update public.service_request_dispatches d
set next_batch_at = now() + interval '90 minutes'
from _fin f
where d.service_request_id = f.sr_id;

create temp table _nb_frozen as
select d.next_batch_at
from public.service_request_dispatches d
join _fin f on d.service_request_id = f.sr_id;

select lives_ok(
  $sql$
    select public.matching_bootstrap_dispatch_for_service_request(
      (select sr_id from _fin)
    )
  $sql$,
  'second matching_bootstrap_dispatch is a no-op on conflict'
);

select is(
  (
    select d.next_batch_at
    from public.service_request_dispatches d
    join _fin f on d.service_request_id = f.sr_id
  ),
  (select next_batch_at from _nb_frozen),
  '2.3 ON CONFLICT DO NOTHING does not reset next_batch_at'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = (select sr_id from _fin)
  ),
  1,
  'bootstrap conflict keeps a single dispatch row'
);

-- ---------------------------------------------------------------------------
-- D. republish → fresh PENDING enrichment, no schema copy, no dispatch
-- ---------------------------------------------------------------------------

create temp table _republish as
select
  gen_random_uuid() as source_sr_id,
  gen_random_uuid() as source_enr_id,
  gen_random_uuid() as idempotency_key,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, cancelled_at, urgency
)
select
  source_sr_id, r.client_id, sr.service_id, sr.address_id,
  'task66 republish source', sr.description, sr.form_data, sr.form_version,
  'CANCELLED'::public.service_request_status, now(), sr.urgency
from _republish r
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, checklist_schema, source, materialized_at
)
select
  source_enr_id,
  source_sr_id,
  'READY'::public.enrichment_status,
  (select schema from _schema),
  'ai'::public.checklist_source,
  now()
from _republish;

select pg_temp.cns_set_auth((select client_id from _republish));

create temp table _republish_out as
select public.republish_cancelled_service_request(
  (select source_sr_id from _republish),
  (select idempotency_key from _republish)
) as payload;

select ok(
  (select (payload->>'requestId')::uuid is distinct from (select source_sr_id from _republish)
   from _republish_out),
  'republish returns a new requestId'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.service_request_id = (select (payload->>'requestId')::uuid from _republish_out)
      and e.status = 'PENDING'::public.enrichment_status
      and e.checklist_schema is null
      and e.source is null
      and e.materialized_at is null
  ),
  '2.9 republish enqueues fresh PENDING enrichment without copying schema'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = (select (payload->>'requestId')::uuid from _republish_out)
  ),
  0,
  '2.9 republish does not bootstrap matching dispatch'
);

select ok(
  (
    select e.id
    from public.service_request_enrichments e
    where e.service_request_id = (select (payload->>'requestId')::uuid from _republish_out)
  ) is distinct from (select source_enr_id from _republish),
  'republish enrichment row is distinct from source enrichment'
);

-- ---------------------------------------------------------------------------
-- E. repair READY-without-dispatch bootstraps once; schema unchanged
-- ---------------------------------------------------------------------------

create temp table _repair as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'task66 repair bootstrap', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _repair f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, checklist_schema, source, materialized_at
)
select
  enr_id,
  sr_id,
  'READY'::public.enrichment_status,
  (select schema from _schema),
  'fallback_template'::public.checklist_source,
  now()
from _repair;

create temp table _repair_schema as
select e.checklist_schema, e.source, e.materialized_at
from public.service_request_enrichments e
join _repair r on e.id = r.enr_id;

-- Give other READY-without-dispatch rows a dispatch so this fixture is the only repair candidate.
insert into public.service_request_dispatches (
  service_request_id, status, next_batch_at
)
select
  e.service_request_id,
  'DISPATCH_PENDING'::public.service_request_dispatch_status,
  now() + interval '1 hour'
from public.service_request_enrichments e
where e.status = 'READY'::public.enrichment_status
  and e.checklist_schema is not null
  and e.id <> (select enr_id from _repair)
  and not exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = e.service_request_id
  )
on conflict (service_request_id) do nothing;

select pg_temp.set_service_role();

select is(
  (public.enrichment_repair_ready_without_dispatch(10)->>'repaired_count')::int,
  1,
  '2.7 repair bootstraps READY enrichment missing dispatch'
);

select ok(
  exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = (select sr_id from _repair)
      and d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status
      and d.next_batch_at > now()
  )
  and (
    select e.checklist_schema
    from public.service_request_enrichments e
    join _repair r on e.id = r.enr_id
  ) = (select checklist_schema from _repair_schema)
  and (
    select e.source
    from public.service_request_enrichments e
    join _repair r on e.id = r.enr_id
  ) = (select source from _repair_schema),
  '2.7 repair creates delayed DISPATCH_PENDING without rewriting schema'
);

select is(
  (public.enrichment_repair_ready_without_dispatch(10)->>'repaired_count')::int,
  0,
  '2.7 second repair is idempotent'
);

select * from finish();

rollback;
