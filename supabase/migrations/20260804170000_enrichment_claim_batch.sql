-- Service completion Task 17: enrichment_claim_batch (design §6.2).
-- SKIP LOCKED claim; skip ops_attention; service_role only.

create or replace function public.enrichment_claim_batch(
  p_lease_owner text,
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_ttl_seconds int;
  v_rows jsonb := '[]'::jsonb;
  v_claimed record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for enrichment_claim_batch'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_lease_owner), '') is null then
    raise exception 'p_lease_owner is required'
      using errcode = '22023';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('enrichment_claim_batch_size', 20)
    ),
    1
  );
  v_ttl_seconds := public.platform_constant_int('enrichment_lease_ttl_seconds', 120);

  for v_claimed in
    with due as (
      select e.id
      from public.service_request_enrichments e
      where e.status = 'PENDING'::public.enrichment_status
        and e.ops_attention_at is null
        and (e.next_attempt_at is null or e.next_attempt_at <= now())
      order by e.next_attempt_at nulls first, e.created_at
      for update of e skip locked
      limit v_batch_size
    ),
    claimed as (
      update public.service_request_enrichments e
      set
        status = 'RUNNING'::public.enrichment_status,
        lease_owner = btrim(p_lease_owner),
        lease_generation = e.lease_generation + 1,
        locked_until = now() + make_interval(secs => v_ttl_seconds),
        updated_at = now()
      from due
      where e.id = due.id
      returning
        e.id,
        e.service_request_id,
        e.status,
        e.attempt_count,
        e.lease_owner,
        e.lease_generation,
        e.locked_until,
        e.correlation_id,
        e.created_at
    )
    select * from claimed
  loop
    perform public.enrichment_append_event(
      v_claimed.id,
      'CLAIMED',
      'enrichment_claim_batch',
      'RUNNING'::public.enrichment_status,
      'PENDING'::public.enrichment_status,
      v_claimed.correlation_id,
      jsonb_build_object(
        'lease_owner', v_claimed.lease_owner,
        'lease_generation', v_claimed.lease_generation,
        'locked_until', v_claimed.locked_until
      )
    );

    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object(
        'id', v_claimed.id,
        'service_request_id', v_claimed.service_request_id,
        'status', v_claimed.status,
        'attempt_count', v_claimed.attempt_count,
        'lease_owner', v_claimed.lease_owner,
        'lease_generation', v_claimed.lease_generation,
        'locked_until', v_claimed.locked_until,
        'correlation_id', v_claimed.correlation_id,
        'created_at', v_claimed.created_at
      )
    );
  end loop;

  return v_rows;
end;
$$;

comment on function public.enrichment_claim_batch(text, int) is
  'Claim due PENDING enrichments (ops_attention skipped) via FOR UPDATE SKIP LOCKED; set RUNNING+lease+generation; append CLAIMED. service_role only.';

revoke all on function public.enrichment_claim_batch(text, int)
  from public, anon, authenticated;
grant execute on function public.enrichment_claim_batch(text, int) to service_role;
