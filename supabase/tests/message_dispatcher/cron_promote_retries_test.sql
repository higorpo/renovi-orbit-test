-- pgTAP: mmd_promote_retries pg_cron job (design §6.4, task 41).

begin;

select plan(2);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_promote_retries'
      and j.schedule = '* * * * *'
      and j.command like '%message_dispatcher_promote_retries%'
  ),
  'mmd_promote_retries cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_promote_retries'
      and j.active = true
  ),
  'cron job is active'
);

select finish();

rollback;
