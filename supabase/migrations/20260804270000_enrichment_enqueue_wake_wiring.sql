-- Service completion Task 27: harden enqueue → orbit_invoke wake (design §4.1.1).
-- Tasks 13–14 already called generate-completion-checklist; this migration:
--   - includes correlation_id in wake payload (observability)
--   - wakes only when a PENDING row was actually inserted (skip ON CONFLICT no-op)
--   - keeps wake best-effort (MUST NOT fail create/republish)

create or replace function public.service_request_enqueue_enrichment(
  p_service_request_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_inserted int := 0;
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  insert into public.service_request_enrichments (
    service_request_id,
    status,
    attempt_count,
    next_attempt_at,
    correlation_id
  )
  values (
    p_service_request_id,
    'PENDING'::public.enrichment_status,
    0,
    null,
    v_correlation_id
  )
  on conflict (service_request_id) do nothing;

  get diagnostics v_inserted = row_count;

  raise log
    'service_request_enqueue_enrichment pending service_request_id=% correlation_id=% inserted=%',
    p_service_request_id,
    v_correlation_id,
    v_inserted;

  -- Best-effort immediate wake after PENDING enqueue (pg_net deferred until commit).
  -- Skip when ON CONFLICT DO NOTHING — durability remains via PENDING + cron (Task 28).
  if v_inserted > 0 and public.orbit_internal_edge_invoke_is_configured() then
    begin
      perform public.orbit_invoke_edge_function(
        'generate-completion-checklist',
        jsonb_build_object(
          'reason', 'enqueue_wake',
          'service_request_id', p_service_request_id,
          'correlation_id', v_correlation_id
        ),
        60000
      );
    exception
      when others then
        raise warning
          'service_request_enqueue_enrichment wake generate-completion-checklist failed: %',
          sqlerrm;
    end;
  end if;
end;
$$;

comment on function public.service_request_enqueue_enrichment(uuid, uuid) is
  'Insert PENDING enrichment UNIQUE(service_request_id) ON CONFLICT DO NOTHING; best-effort orbit_invoke wake generate-completion-checklist with enqueue_wake payload (Task 27 / design §4.1.1). Wake failure does not fail caller; cron is safety net.';

revoke all on function public.service_request_enqueue_enrichment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to service_role;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to postgres;
