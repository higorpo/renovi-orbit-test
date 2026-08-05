-- Service completion Task 54: enrichment events completeness + correlation.
-- Gaps closed: ENQUEUED on insert; append_event always stamps lease_generation
-- into payload; repair passes correlation_id; event_type comment aligned.

comment on column public.service_request_enrichment_events.event_type is
  'ENQUEUED|CLAIMED|RETRY|READY|FALLBACK_APPLIED|ABORTED|RECLAIM|OPS_ATTENTION|OPS_ATTENTION_CLEARED|BOOTSTRAP_REPAIR|…';

create or replace function public.enrichment_append_event(
  p_enrichment_id uuid,
  p_event_type text,
  p_actor text,
  p_to_status public.enrichment_status,
  p_from_status public.enrichment_status default null,
  p_correlation_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_request_enrichments%rowtype;
  v_correlation_id uuid;
begin
  if p_enrichment_id is null then
    raise exception 'p_enrichment_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_event_type), '') is null then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_actor), '') is null then
    raise exception 'p_actor is required'
      using errcode = '22023';
  end if;

  if p_to_status is null then
    raise exception 'p_to_status is required'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.service_request_enrichments e
  where e.id = p_enrichment_id;

  if not found then
    raise exception 'enrichment not found: %', p_enrichment_id
      using errcode = 'P0002';
  end if;

  v_correlation_id := coalesce(p_correlation_id, v_row.correlation_id);

  insert into public.service_request_enrichment_events (
    enrichment_id,
    service_request_id,
    from_status,
    to_status,
    actor,
    event_type,
    lease_generation,
    correlation_id,
    payload
  )
  values (
    v_row.id,
    v_row.service_request_id,
    -- Explicit null allowed (e.g. ENQUEUED birth); callers pass from_status.
    p_from_status,
    p_to_status,
    btrim(p_actor),
    btrim(p_event_type),
    v_row.lease_generation,
    v_correlation_id,
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object('lease_generation', v_row.lease_generation)
  );
end;
$$;

comment on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) is
  'Append-only enrichment FSM audit insert; stamps lease_generation column + payload. Used by enqueue/claim/finalize/abort/reclaim/ops.';

revoke all on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to service_role;
grant execute on function public.enrichment_append_event(
  uuid, text, text, public.enrichment_status, public.enrichment_status, uuid, jsonb
) to postgres;

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
  v_enrichment_id uuid;
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
  on conflict (service_request_id) do nothing
  returning id into v_enrichment_id;

  get diagnostics v_inserted = row_count;

  raise log
    'service_request_enqueue_enrichment pending service_request_id=% correlation_id=% inserted=%',
    p_service_request_id,
    v_correlation_id,
    v_inserted;

  if v_inserted > 0 and v_enrichment_id is not null then
    perform public.enrichment_append_event(
      v_enrichment_id,
      'ENQUEUED',
      'service_request_enqueue_enrichment',
      'PENDING'::public.enrichment_status,
      null,
      v_correlation_id,
      jsonb_build_object('service_request_id', p_service_request_id)
    );
  end if;

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
  'Insert PENDING enrichment UNIQUE(service_request_id) ON CONFLICT DO NOTHING; append ENQUEUED; best-effort orbit_invoke wake with correlation_id (Task 54 / design §4.1.1).';

revoke all on function public.service_request_enqueue_enrichment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to service_role;
grant execute on function public.service_request_enqueue_enrichment(uuid, uuid)
  to postgres;

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
    select e.id, e.service_request_id, e.correlation_id, e.lease_generation
    from public.service_request_enrichments e
    where e.status = 'READY'::public.enrichment_status
      and e.checklist_schema is not null
      -- Bound scan: same 7-day window as 042400 (avoid unbounded READY-without-dispatch sweep).
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
      v_row.correlation_id,
      jsonb_build_object(
        'reason', 'ready_without_dispatch',
        'lease_generation', v_row.lease_generation
      )
    );

    v_repaired := v_repaired || jsonb_build_array(
      jsonb_build_object(
        'enrichment_id', v_row.id,
        'service_request_id', v_row.service_request_id,
        'correlation_id', v_row.correlation_id
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
  'Sweeper: READY enrichments missing service_request_dispatches → matching_bootstrap only; append BOOTSTRAP_REPAIR with correlation_id. service_role only.';

revoke all on function public.enrichment_repair_ready_without_dispatch(int)
  from public, anon, authenticated;
grant execute on function public.enrichment_repair_ready_without_dispatch(int) to service_role;
