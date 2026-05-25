-- pgTAP: mmd_reclaim_leases pg_cron job (design §6.4, task 42).

begin;

select plan(2);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_reclaim_leases'
      and j.schedule = '* * * * *'
      and j.command like '%message_dispatcher_reclaim_leases%'
  ),
  'mmd_reclaim_leases cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_reclaim_leases'
      and j.active = true
  ),
  'cron job is active'
);

select finish();

rollback;
