-- pgTAP: failure injection — lease recovery, cron concurrency, timeout abort (task 75).

begin;

select plan(23);

create or replace function pg_temp.failure_inject_seed_open_service_request()
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
    'failure injection pgTAP fixture',
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

create or replace function pg_temp.failure_inject_quarantine_other_dispatches(p_dispatch_id uuid)
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

-- Simulated worker crash: lease held but worker never released -----------------

create temp table _crash_sr as
select pg_temp.failure_inject_seed_open_service_request() as service_request_id;

create temp table _crash_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _crash_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute',
  lease_owner = 'matching_cron:crashed-worker',
  lease_expires_at = now() + interval '10 minutes'
where id = (select dispatch_id from _crash_dispatch);

select ok(
  not public.matching_acquire_dispatch_lease(
    (select dispatch_id from _crash_dispatch),
    'matching_cron:recovery-worker'
  ),
  'crashed worker lease blocks another worker from acquiring'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _crash_dispatch)
  ),
  0,
  'process_dispatch_row opens no batch while crashed worker holds lease'
);

select lives_ok(
  format(
    'select public.matching_process_dispatch_row(%L::uuid, %s)',
    (select dispatch_id from _crash_dispatch),
    75001
  ),
  'process_dispatch_row returns without error when lease is held'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _crash_dispatch)
  ),
  0,
  'still no batch after no-op process_dispatch_row under crashed lease'
);

update public.service_request_dispatches
set lease_expires_at = now() - interval '15 minutes'
where id = (select dispatch_id from _crash_dispatch);

select is(
  (public.matching_force_release_stale_leases(interval '10 minutes', 100)->>'released_count')::int,
  1,
  'stale lease janitor releases crashed worker lease'
);

select ok(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _crash_dispatch),
    'matching_cron:recovery-worker'
  ),
  'recovery worker acquires lease after stale release'
);

select public.matching_release_dispatch_lease((select dispatch_id from _crash_dispatch));

select lives_ok(
  format(
    'select public.matching_process_dispatch_row(%L::uuid, %s)',
    (select dispatch_id from _crash_dispatch),
    75002
  ),
  'recovery worker opens batch after lease cleanup'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _crash_dispatch)
  ),
  1,
  'exactly one batch after crash recovery'
);

-- Expired lease re-acquire -------------------------------------------------------

create temp table _expired_sr as
select pg_temp.failure_inject_seed_open_service_request() as service_request_id;

create temp table _expired_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _expired_sr);

select ok(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _expired_dispatch),
    'matching_cron:expired-a'
  ),
  'first worker acquires unleased dispatch'
);

update public.service_request_dispatches
set lease_expires_at = now() - interval '1 minute'
where id = (select dispatch_id from _expired_dispatch);

select ok(
  public.matching_acquire_dispatch_lease(
    (select dispatch_id from _expired_dispatch),
    'matching_cron:expired-b'
  ),
  'expired lease can be re-acquired by another worker'
);

select public.matching_release_dispatch_lease((select dispatch_id from _expired_dispatch));

-- Concurrent cron invocations --------------------------------------------------

create temp table _cron_sr as
select pg_temp.failure_inject_seed_open_service_request() as service_request_id;

create temp table _cron_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _cron_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _cron_dispatch);

select pg_temp.failure_inject_quarantine_other_dispatches(
  (select dispatch_id from _cron_dispatch)
);

select lives_ok(
  'select public.cron_process_service_request_dispatches()',
  'first cron_process_service_request_dispatches invocation succeeds'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _cron_dispatch)
  ),
  1,
  'first cron tick opens exactly one batch'
);

select lives_ok(
  'select public.cron_process_service_request_dispatches()',
  'second concurrent cron tick succeeds without duplicate batch open'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _cron_dispatch)
  ),
  1,
  'second cron tick does not duplicate batch while next_batch_at is future'
);

select ok(
  (
    select count(*) = count(distinct b.batch_number)
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _cron_dispatch)
  ),
  'no duplicate batch_number for same dispatch after concurrent cron ticks'
);

select is(
  (
    select count(*)::int
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _cron_sr)
      and v.source = 'batch'
      and v.revoked_at is null
  ),
  (
    select count(*)::int
    from public.service_request_dispatch_batch_providers bp
    join public.service_request_dispatch_batches b on b.id = bp.batch_id
    where b.dispatch_id = (select dispatch_id from _cron_dispatch)
  ),
  'batch visibility rows match batch_providers after successful cron open'
);

-- Discovery statement_timeout -> job_run_abort path ------------------------------

create temp table _timeout_sr as
select pg_temp.failure_inject_seed_open_service_request() as service_request_id;

create temp table _timeout_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _timeout_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _timeout_dispatch);

update public.job_runs
set
  finished_at = coalesce(finished_at, now()),
  error_count = coalesce(error_count, 0)
where job_name = 'matching_process_service_request_dispatches'
  and finished_at is null;

create temp table _timeout_job_run as
select public.job_run_begin(
  'matching_process_service_request_dispatches',
  'failure_inject'
) as job_run_id;

create or replace function public.matching_open_batch(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  raise exception using
    errcode = '57014',
    message = 'canceling statement due to statement timeout';
end;
$$;

create temp table _timeout_abort (
  caught boolean not null default false,
  sqlstate text
);

do $timeout$
begin
  begin
    perform public.matching_process_dispatch_row(
      (select dispatch_id from _timeout_dispatch),
      (select job_run_id from _timeout_job_run)
    );
  exception
    when query_canceled then
      insert into _timeout_abort (caught, sqlstate)
      values (true, sqlstate);
      perform public.job_run_abort_latest(
        'matching_process_service_request_dispatches',
        sqlerrm
      );
  end;
end;
$timeout$;

select ok(
  (select caught from _timeout_abort),
  'matching_process_dispatch_row propagates query_canceled on discovery timeout'
);

select is(
  (select sqlstate from _timeout_abort),
  '57014',
  'statement_timeout surfaces SQLSTATE 57014'
);

select ok(
  (
    select jr.error_count >= 1
      and jr.finished_at is not null
      and coalesce(jr.metadata->>'fatal_error', '') <> ''
    from public.job_runs jr
    where jr.id = (select job_run_id from _timeout_job_run)
  ),
  'job_run_abort_latest records error row after statement_timeout'
);

select ok(
  (
    select d.lease_owner is null and d.lease_expires_at is null
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _timeout_dispatch)
  ),
  'lease is released after statement_timeout abort'
);

-- Txn rollback: no orphan visibility without batch row ---------------------------

create temp table _rollback_sr as
select pg_temp.failure_inject_seed_open_service_request() as service_request_id;

create temp table _rollback_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _rollback_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _rollback_dispatch);

create or replace function public.matching_open_batch(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_d public.service_request_dispatches%rowtype;
  v_new_batch_number int;
begin
  select *
  into v_d
  from public.service_request_dispatches
  where id = p_dispatch_id
  for update;

  if not found then
    return;
  end if;

  v_new_batch_number := v_d.batch_sequence + 1;

  insert into public.service_request_dispatch_batches (
    dispatch_id,
    batch_number,
    explored_h3_cells
  )
  values (p_dispatch_id, v_new_batch_number, '[]'::jsonb);

  raise exception 'failure_injection: abort before visibility grant';
end;
$$;

select throws_ok(
  format(
    'select public.matching_process_dispatch_row(%L::uuid, %s)',
    (select dispatch_id from _rollback_dispatch),
    75003
  ),
  'P0001',
  'failure_injection: abort before visibility grant',
  'matching_open_batch failure rolls back batch insert'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _rollback_dispatch)
  ),
  0,
  'txn rollback leaves no batch row after injected open_batch failure'
);

select is(
  (
    select count(*)::int
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _rollback_sr)
      and v.source = 'batch'
      and v.revoked_at is null
  ),
  0,
  'txn rollback leaves no orphan batch visibility without batch row'
);

select finish();

rollback;
