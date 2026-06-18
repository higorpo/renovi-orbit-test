-- pgTAP: concurrent cron worker safety — lease CAS + no duplicate batch open (task 54).

begin;

select plan(9);

create or replace function pg_temp.concurrency_seed_open_service_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency,
    location
  )
  select
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'concurrency cron pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency,
    (
      select location
      from public.service_requests
      where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
    )
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.concurrency_quarantine_other_dispatches(p_dispatch_id uuid)
returns void
language sql
as $$
  update public.service_request_dispatches d
  set next_batch_at = now() + interval '1 year'
  where d.id <> p_dispatch_id
    and d.next_batch_at <= now()
    and d.status in (
      'DISPATCH_PENDING'::public.service_request_dispatch_status,
      'DISPATCH_ACTIVE'::public.service_request_dispatch_status
    );
$$;

create temp table _concurrency_sr as
select pg_temp.concurrency_seed_open_service_request() as service_request_id;

create temp table _concurrency_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _concurrency_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _concurrency_dispatch);

select pg_temp.concurrency_quarantine_other_dispatches(
  (select dispatch_id from _concurrency_dispatch)
);

-- Lease CAS: only one overlapping worker acquires --------------------------------

select ok(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _concurrency_dispatch),
    'matching_cron:worker-a'
  ),
  'worker A acquires dispatch lease'
);

select ok(
  not public.matching_acquire_dispatch_lease(
    (select dispatch_id from _concurrency_dispatch),
    'matching_cron:worker-b'
  ),
  'worker B cannot acquire while worker A holds active lease'
);

-- Overlapping process_dispatch_row is a no-op when lease is held -----------------

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _concurrency_dispatch)
  ),
  0,
  'no batch exists before worker B attempt'
);

select lives_ok(
  format(
    'select public.matching_process_dispatch_row(%L::uuid, %s)',
    (select dispatch_id from _concurrency_dispatch),
    9002
  ),
  'worker B process_dispatch_row returns without error while lease held'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _concurrency_dispatch)
  ),
  0,
  'worker B does not open a batch while worker A holds lease'
);

-- Worker A completes; overlapping cron tick still respects next_batch_at ---------

select public.matching_release_dispatch_lease(
  (select dispatch_id from _concurrency_dispatch)
);

select lives_ok(
  format(
    'select public.matching_process_dispatch_row(%L::uuid, %s)',
    (select dispatch_id from _concurrency_dispatch),
    9001
  ),
  'worker A opens batch via process_dispatch_row'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _concurrency_dispatch)
  ),
  1,
  'worker A opens exactly one batch'
);

select public.cron_process_service_request_dispatches();

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _concurrency_dispatch)
  ),
  1,
  'immediate second cron tick does not duplicate batch while next_batch_at is future'
);

-- No duplicate batch_providers for the same batch --------------------------------

select ok(
  (
    select count(*) = count(distinct (bp.batch_id, bp.provider_id))
    from public.service_request_dispatch_batch_providers bp
    join public.service_request_dispatch_batches b on b.id = bp.batch_id
    where b.dispatch_id = (select dispatch_id from _concurrency_dispatch)
  ),
  'batch_providers has no duplicate provider rows per batch'
);

select finish();

rollback;
