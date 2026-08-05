-- Service completion Task 24: enrichment_repair_ready_without_dispatch (design §3.7 sweeper).
-- Full pgTAP suite: Task 67.

create or replace function public.enrichment_repair_ready_without_dispatch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_repaired jsonb := '[]'::jsonb;
  v_row record;
  v_count int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_repair_ready_without_dispatch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('enrichment_claim_batch_size', 20)
    ),
    1
  );

  for v_row in
    select e.id, e.service_request_id
    from public.service_request_enrichments e
    where e.status = 'READY'::public.enrichment_status
      and e.checklist_schema is not null
      -- Bound scan: avoid full-table READY sweep on every cron tick (stale rows stay repairable via ops).
      and e.materialized_at >= now() - interval '7 days'
      and not exists (
        select 1
        from public.service_request_dispatches d
        where d.service_request_id = e.service_request_id
      )
    order by e.materialized_at nulls last, e.created_at
    for update of e skip locked
    limit v_batch_size
  loop
    -- MUST NOT regenerate schema — bootstrap only.
    perform public.matching_bootstrap_dispatch_for_service_request(v_row.service_request_id);

    perform public.enrichment_append_event(
      v_row.id,
      'BOOTSTRAP_REPAIR',
      'enrichment_repair_ready_without_dispatch',
      'READY'::public.enrichment_status,
      'READY'::public.enrichment_status,
      null,
      jsonb_build_object('reason', 'ready_without_dispatch')
    );

    v_repaired := v_repaired || jsonb_build_array(
      jsonb_build_object(
        'enrichment_id', v_row.id,
        'service_request_id', v_row.service_request_id
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'repaired_count', v_count,
    'repaired', v_repaired
  );
end;
$$;

comment on function public.enrichment_repair_ready_without_dispatch(int) is
  'Sweeper: READY enrichments missing service_request_dispatches → matching_bootstrap only (no schema rewrite). service_role only.';

revoke all on function public.enrichment_repair_ready_without_dispatch(int)
  from public, anon, authenticated;
grant execute on function public.enrichment_repair_ready_without_dispatch(int) to service_role;
