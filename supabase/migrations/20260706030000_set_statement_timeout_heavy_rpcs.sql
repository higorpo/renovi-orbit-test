-- Belt-and-suspenders statement_timeout on heavy RPCs (complements in-body cns_set_local_statement_timeout).

alter function public.cns_process_domain_events(int, text, boolean)
  set statement_timeout = '120s';

alter function public.expire_pending_proposals(int)
  set statement_timeout = '120s';

alter function public.cns_evaluate_reciprocity_batch(int)
  set statement_timeout = '120s';

alter function public.cns_janitor_orphan_media(int)
  set statement_timeout = '120s';

alter function public.cns_reconcile_pending_deliveries(int)
  set statement_timeout = '120s';

alter function public.cns_prune_chat_rate_limit_buckets(int, int)
  set statement_timeout = '120s';

alter function public.cns_prune_job_runs(int, int)
  set statement_timeout = '120s';

alter function public.domain_events_release_stale_leases()
  set statement_timeout = '120s';

alter function public.enqueue_proposal_expiring_soon_reminders(int)
  set statement_timeout = '120s';

alter function public.purge_stale_user_device_beacons()
  set statement_timeout = '120s';

alter function public.list_services(integer, integer, text, text, text, text, text, date, date, boolean, boolean)
  set statement_timeout = '30s';

alter function public.get_service(uuid)
  set statement_timeout = '15s';
