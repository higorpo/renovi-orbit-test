-- pgTAP: mmd_invoke_worker pg_cron + invoke RPC (design §6.4, task 70).

begin;

\ir fixtures/clear_due_dispatches.inc

select plan(4);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_invoke_worker'
  ),
  'message_dispatcher_invoke_worker function exists'
);

select is(
  message_dispatcher.message_dispatcher_invoke_worker(),
  0,
  'invoke_worker returns 0 when vault secrets are unset'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_invoke_worker'
      and j.schedule = '*/1 * * * *'
      and j.command like '%message_dispatcher_invoke_worker%'
  ),
  'mmd_invoke_worker cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'mmd_invoke_worker'
      and j.active = true
  ),
  'mmd_invoke_worker cron job is active'
);

select finish();

rollback;
