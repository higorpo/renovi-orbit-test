-- Matching task 50 — explicit anon/authenticated EXECUTE revokes on all internal matching RPCs.

revoke all on function public.evaluate_service_request_dispatch_gates(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_open_batch(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_process_dispatch_row(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.matching_acquire_dispatch_lease(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.matching_renew_dispatch_lease(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.matching_release_dispatch_lease(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_compute_explored_h3_cells(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_discover_candidates(uuid, int)
  from public, anon, authenticated;
revoke all on function public.matching_rank_candidates(uuid, uuid[])
  from public, anon, authenticated;
revoke all on function public.matching_rank_candidates_with_discover(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.matching_h3_ring_cells(bigint, int)
  from public, anon, authenticated;
revoke all on function public.matching_latlng_to_h3_cell(extensions.geography, int)
  from public, anon, authenticated;
revoke all on function public.matching_refresh_provider_latest_location(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_refresh_provider_rating_stats(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_refresh_provider_proposal_stats(uuid)
  from public, anon, authenticated;
revoke all on function public.matching_cancel_pending_mmd_for_service_request(uuid, text)
  from public, anon, authenticated;
revoke all on function public.matching_force_release_stale_leases(interval, int)
  from public, anon, authenticated;
revoke all on function public.matching_ops_consecutive_cron_errors(int, int)
  from public, anon, authenticated;
revoke all on function public.matching_encode_feed_cursor(jsonb)
  from public, anon, authenticated;
revoke all on function public.matching_decode_feed_cursor(text)
  from public, anon, authenticated;
revoke all on function public.matching_provider_has_opportunity_access(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.list_provider_opportunities(
  uuid,
  double precision,
  double precision,
  text,
  text,
  int
) from public, anon, authenticated;
revoke all on function public.trg_fn_service_request_dispatch_bootstrap()
  from public, anon, authenticated;
revoke all on function public.trg_fn_profiles_bootstrap_provider_matching_stats()
  from public, anon, authenticated;
revoke all on function public.trg_fn_service_ratings_refresh_provider_rating_stats()
  from public, anon, authenticated;
revoke all on function public.trg_fn_provider_proposals_refresh_proposal_stats()
  from public, anon, authenticated;
revoke all on function public.trg_user_device_beacon_refresh_provider_location()
  from public, anon, authenticated;
revoke all on function public.trg_fn_matching_batch_provider_notify()
  from public, anon, authenticated;

grant execute on function public.evaluate_service_request_dispatch_gates(uuid) to service_role;
grant execute on function public.matching_open_batch(uuid) to service_role;
grant execute on function public.matching_process_dispatch_row(uuid, bigint) to service_role;
grant execute on function public.matching_acquire_dispatch_lease(uuid, text, int) to service_role;
grant execute on function public.matching_renew_dispatch_lease(uuid, text, int) to service_role;
grant execute on function public.matching_release_dispatch_lease(uuid) to service_role;
grant execute on function public.matching_compute_explored_h3_cells(uuid) to service_role;
grant execute on function public.matching_discover_candidates(uuid, int) to service_role;
grant execute on function public.matching_rank_candidates(uuid, uuid[]) to service_role;
grant execute on function public.matching_rank_candidates_with_discover(uuid, jsonb) to service_role;
grant execute on function public.matching_refresh_provider_latest_location(uuid) to service_role;
grant execute on function public.matching_cancel_pending_mmd_for_service_request(uuid, text) to service_role;
grant execute on function public.matching_force_release_stale_leases(interval, int) to service_role;
grant execute on function public.matching_ops_consecutive_cron_errors(int, int) to service_role;
grant execute on function public.matching_encode_feed_cursor(jsonb) to service_role;
grant execute on function public.matching_decode_feed_cursor(text) to service_role;
grant execute on function public.matching_provider_has_opportunity_access(uuid, uuid) to service_role;
grant execute on function public.list_provider_opportunities(
  uuid,
  double precision,
  double precision,
  text,
  text,
  int
) to service_role;
