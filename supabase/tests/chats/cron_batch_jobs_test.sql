-- pgTAP: CNS reciprocity and proposal expiry pg_cron jobs (design §6.1, task 40).

begin;

select plan(8);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_chat_evaluate_reciprocity'
  ),
  'cron_chat_evaluate_reciprocity is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_chat_evaluate_reciprocity()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_chat_evaluate_reciprocity()',
    'EXECUTE'
  ),
  'postgres only may execute chat reciprocity cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'chat_evaluate_reciprocity'
      and j.schedule = '*/10 * * * *'
      and j.command like '%cron_chat_evaluate_reciprocity%'
  ),
  'chat_evaluate_reciprocity cron job exists (R25-AC01, OAC-06)'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'chat_evaluate_reciprocity'
      and j.active = true
  ),
  'chat_evaluate_reciprocity cron job is active'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_proposal_expire_pending'
  ),
  'cron_proposal_expire_pending is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_proposal_expire_pending()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_proposal_expire_pending()',
    'EXECUTE'
  ),
  'postgres only may execute proposal expiry cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'proposal_expire_pending'
      and j.schedule = '*/10 * * * *'
      and j.command like '%cron_proposal_expire_pending%'
  ),
  'proposal_expire_pending cron job exists (R25-AC02, OAC-06)'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'proposal_expire_pending'
      and j.active = true
  ),
  'proposal_expire_pending cron job is active'
);

select finish();

rollback;
