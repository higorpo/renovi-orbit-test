-- pgTAP: cron_process_service_request_dispatches worker (matching M10c).

begin;

select plan(15);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_process_service_request_dispatches'
  ),
  'cron_process_service_request_dispatches is SECURITY DEFINER'
);

select ok(
  pg_get_functiondef('public.cron_process_service_request_dispatches()'::regprocedure) ilike '%skip locked%',
  'worker loops use FOR UPDATE SKIP LOCKED'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'matching_process_service_request_dispatches'
      and j.schedule = '*/2 * * * *'
      and j.command like '%cron_process_service_request_dispatches%'
  ),
  'matching_process_service_request_dispatches cron is scheduled every 2 minutes'
);

create or replace function pg_temp.cron_set_auth(p_user_id uuid)
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

create or replace function pg_temp.cron_quarantine_other_dispatches(p_dispatch_id uuid)
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

create or replace function pg_temp.cron_quarantine_other_stopped(p_dispatch_id uuid)
returns void
language sql
as $$
  update public.service_request_dispatches d
  set
    status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
    next_batch_at = now() + interval '1 year'
  where d.id <> p_dispatch_id
    and d.status in (
      'DISPATCH_PAUSED'::public.service_request_dispatch_status,
      'DISPATCH_STOPPED'::public.service_request_dispatch_status
    );
$$;

create or replace function pg_temp.matching_seed_open_service_request(
  p_location extensions.geography default null
)
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
    'matching cron pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency,
    coalesce(
      p_location,
      (
        select location
        from public.service_requests
        where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
      )
    )
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create or replace function pg_temp.cron_submit_proposal(
  p_provider_id uuid,
  p_service_request_id uuid
)
returns void
language plpgsql
as $$
declare
  v_pricing record;
begin
  perform pg_temp.cron_set_auth(p_provider_id);
  select * into v_pricing from public.calculate_provider_service_pricing(150.00::numeric);
  perform public.create_provider_proposal(
    p_service_request_id,
    gen_random_uuid(),
    v_pricing.original_amount,
    'Cron gate proposal fixture',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', to_char(current_date + 2, 'YYYY-MM-DD'),
        'shift', 'morning'
      )
    ),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature
  );
end;
$$;

create temp table _expired_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

update public.service_request_dispatches
set created_at = now() - interval '49 hours'
where service_request_id = (select service_request_id from _expired_sr);

select public.cron_process_service_request_dispatches();

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _expired_sr)
  ),
  'DISPATCH_EXPIRED',
  'phase 1 lifecycle sweep expires stale dispatches'
);

create temp table _batch_open_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _batch_open_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _batch_open_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_PENDING'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _batch_open_dispatch);

select pg_temp.cron_quarantine_other_dispatches((select dispatch_id from _batch_open_dispatch));

select public.cron_process_service_request_dispatches();

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _batch_open_dispatch)
  ),
  'DISPATCH_ACTIVE',
  'phase 2a opens a batch when next_batch_at is due and gates are clear'
);

select ok(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _batch_open_dispatch)
  ) >= 1,
  'phase 2a persists at least one batch row'
);

create temp table _stopped_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _stopped_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _stopped_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _stopped_dispatch);

update public.platform_constants
set value = '2'::jsonb
where key = 'chats.max_active_slots_per_service_request';

select pg_temp.cron_submit_proposal(
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  (select service_request_id from _stopped_sr)
);
select pg_temp.cron_submit_proposal(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  (select service_request_id from _stopped_sr)
);

select pg_temp.cron_quarantine_other_dispatches((select dispatch_id from _stopped_dispatch));

select public.cron_process_service_request_dispatches();

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _stopped_dispatch)
  ),
  'DISPATCH_STOPPED',
  'phase 2a gate eval stops dispatch before batch open when slots are full'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _stopped_dispatch)
  ),
  0,
  'STOPPED dispatch does not open a batch during cron tick'
);

update public.platform_constants
set value = '4'::jsonb
where key = 'chats.max_active_slots_per_service_request';

create temp table _phase2b_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _phase2b_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _phase2b_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_STOPPED'::public.service_request_dispatch_status,
  next_batch_at = null,
  updated_at = timestamptz '1970-01-01'
where id = (select dispatch_id from _phase2b_dispatch);

select pg_temp.cron_quarantine_other_stopped((select dispatch_id from _phase2b_dispatch));

select public.cron_process_service_request_dispatches();

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _phase2b_dispatch)
  ),
  'DISPATCH_ACTIVE',
  'phase 2b gate-only pass resumes STOPPED when gates clear'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _phase2b_dispatch)
  ),
  0,
  'phase 2b does not open a batch'
);

create temp table _lease_recovery_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _lease_recovery_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _lease_recovery_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute',
  lease_owner = 'stale-worker',
  lease_expires_at = now() - interval '5 minutes'
where id = (select dispatch_id from _lease_recovery_dispatch);

select pg_temp.cron_quarantine_other_dispatches((select dispatch_id from _lease_recovery_dispatch));

select public.cron_process_service_request_dispatches();

select ok(
  (
    select count(*)::int
    from public.service_request_dispatch_batches b
    where b.dispatch_id = (select dispatch_id from _lease_recovery_dispatch)
  ) >= 1,
  'expired lease is recovered and due dispatch opens a batch'
);

select ok(
  (
    select d.lease_owner is null and d.lease_expires_at is null
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _lease_recovery_dispatch)
  ),
  'lease is cleared after successful cron processing'
);

create temp table _lease_skip_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _lease_skip_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _lease_skip_sr);

update public.service_request_dispatches
set
  status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status,
  next_batch_at = now() - interval '1 minute'
where id = (select dispatch_id from _lease_skip_dispatch);

select pg_temp.cron_quarantine_other_dispatches((select dispatch_id from _lease_skip_dispatch));

select is(
  (
    select public.matching_acquire_dispatch_lease(
      (select dispatch_id from _lease_skip_dispatch),
      'other-worker'
    )
  ),
  true,
  'fixture holds an active lease before cron tick'
);

select public.cron_process_service_request_dispatches();

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _lease_skip_dispatch)
  ),
  'DISPATCH_ACTIVE',
  'active lease prevents cron from processing the held dispatch'
);

select is(
  (
    select d.lease_owner
    from public.service_request_dispatches d
    where d.id = (select dispatch_id from _lease_skip_dispatch)
  ),
  'other-worker',
  'active lease owner is unchanged when cron skips the row'
);

select finish();

rollback;
