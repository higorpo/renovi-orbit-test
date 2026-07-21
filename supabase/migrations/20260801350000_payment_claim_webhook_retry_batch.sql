-- Payment Task 37: payment_claim_webhook_retry_batch RPC (design.md §4.7.4, Req 19 AC2).

create or replace function public.payment_claim_webhook_retry_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_max_retries int;
  v_rows jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_webhook_retry_batch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('webhook_retry_batch_size', 25)
    ),
    1
  );
  v_max_retries := public.platform_constant_int('max_webhook_retries', 3);

  drop table if exists _payment_webhook_retry_claim_batch;

  create temp table _payment_webhook_retry_claim_batch on commit drop as
  with eligible as (
    select e.id
    from public.payment_webhook_events e
    where e.state = 'FAILED'::public.payment_webhook_event_state
      and e.signature_validated
      and coalesce(e.failure_reason, '') <> 'INVALID_SIGNATURE'
      and e.retry_count < v_max_retries
      and (e.next_retry_at is null or e.next_retry_at <= now())
    order by coalesce(e.next_retry_at, e.created_at)
    limit v_batch_size
    for update of e skip locked
  ),
  claimed as (
    update public.payment_webhook_events e
    set
      state = 'PROCESSING'::public.payment_webhook_event_state,
      updated_at = now()
    from eligible el
    where e.id = el.id
    returning
      e.id,
      e.gateway_slug,
      e.event_type,
      e.gateway_event_id,
      e.retry_count,
      e.failure_reason,
      e.state
  )
  select * from claimed;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', 'failed_retry',
        'event_id', c.id,
        'gateway_slug', c.gateway_slug,
        'event_type', c.event_type,
        'gateway_event_id', c.gateway_event_id,
        'retry_count', c.retry_count,
        'failure_reason', c.failure_reason,
        'event_state', c.state
      )
      order by c.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from _payment_webhook_retry_claim_batch c;

  return v_rows;
end;
$$;

comment on function public.payment_claim_webhook_retry_batch(int) is
  'Claims signature-validated FAILED webhook events eligible for retry with SKIP LOCKED (service_role only).';

revoke all on function public.payment_claim_webhook_retry_batch(int) from public;
revoke all on function public.payment_claim_webhook_retry_batch(int) from anon;
revoke all on function public.payment_claim_webhook_retry_batch(int) from authenticated;

grant execute on function public.payment_claim_webhook_retry_batch(int) to service_role;
