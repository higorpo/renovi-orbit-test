-- pgTAP: statement_timeout proconfig on heavy RPCs (20260706030000_set_statement_timeout_heavy_rpcs).

begin;

select plan(12);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_process_domain_events'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_process_domain_events has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'expire_pending_proposals'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'expire_pending_proposals has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_evaluate_reciprocity_batch'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_evaluate_reciprocity_batch has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_janitor_orphan_media'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_janitor_orphan_media has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_reconcile_pending_deliveries'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_reconcile_pending_deliveries has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_prune_chat_rate_limit_buckets'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_prune_chat_rate_limit_buckets has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_prune_job_runs'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'cns_prune_job_runs has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'domain_events_release_stale_leases'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'domain_events_release_stale_leases has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'enqueue_proposal_expiring_soon_reminders'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'enqueue_proposal_expiring_soon_reminders has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'purge_stale_user_device_beacons'
      and 'statement_timeout=120s' = any (p.proconfig)
  ),
  'purge_stale_user_device_beacons has 120s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_services'
      and 'statement_timeout=30s' = any (p.proconfig)
  ),
  'list_services has 30s statement_timeout proconfig'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_service'
      and 'statement_timeout=15s' = any (p.proconfig)
  ),
  'get_service has 15s statement_timeout proconfig'
);

select finish();

rollback;
