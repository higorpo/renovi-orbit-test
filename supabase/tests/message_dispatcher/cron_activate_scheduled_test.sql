-- pgTAP: mmd_activate_scheduled pg_cron job (design §6.4, task 40).

begin;

select plan(2);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_activate_scheduled'
      and j.schedule = '* * * * *'
      and j.command like '%message_dispatcher_activate_scheduled%'
  ),
  'mmd_activate_scheduled cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_activate_scheduled'
      and j.active = true
  ),
  'cron job is active'
);

select finish();

rollback;
