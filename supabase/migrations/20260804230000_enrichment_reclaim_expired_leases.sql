-- Service completion Task 23: enrichment_reclaim_expired_leases (design §6.3).

create or replace function public.enrichment_reclaim_expired_leases(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_reclaimed jsonb := '[]'::jsonb;
  v_row record;
  v_count int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_reclaim_expired_leases'
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
    with expired as (
      select e.id
      from public.service_request_enrichments e
      where e.status = 'RUNNING'::public.enrichment_status
        and e.locked_until is not null
        and e.locked_until < now()
      order by e.locked_until
      for update of e skip locked
      limit v_batch_size
    ),
    reclaimed as (
      update public.service_request_enrichments e
      set
        status = 'PENDING'::public.enrichment_status,
        lease_generation = e.lease_generation + 1,
        lease_owner = null,
        locked_until = null,
        next_attempt_at = null,
        updated_at = now()
      from expired x
      where e.id = x.id
      returning
        e.id,
        e.service_request_id,
        e.lease_generation,
        e.correlation_id
    )
    select * from reclaimed
  loop
    perform public.enrichment_append_event(
      v_row.id,
      'RECLAIM',
      'enrichment_reclaim_expired_leases',
      'PENDING'::public.enrichment_status,
      'RUNNING'::public.enrichment_status,
      v_row.correlation_id,
      jsonb_build_object(
        'lease_generation', v_row.lease_generation,
        'reason', 'lease_expired'
      )
    );

    v_reclaimed := v_reclaimed || jsonb_build_array(
      jsonb_build_object(
        'id', v_row.id,
        'service_request_id', v_row.service_request_id,
        'lease_generation', v_row.lease_generation
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'reclaimed_count', v_count,
    'reclaimed', v_reclaimed
  );
end;
$$;

comment on function public.enrichment_reclaim_expired_leases(int) is
  'Sweeper: RUNNING with locked_until < now() → PENDING, lease_generation++, clear owner. Stale finalize fails CAS. service_role only.';

revoke all on function public.enrichment_reclaim_expired_leases(int)
  from public, anon, authenticated;
grant execute on function public.enrichment_reclaim_expired_leases(int) to service_role;
