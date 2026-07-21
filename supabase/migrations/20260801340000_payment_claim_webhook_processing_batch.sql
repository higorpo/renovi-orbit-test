-- Payment Task 36: payment_claim_webhook_processing_batch RPC (design.md §4.7.2, Req 19).

create or replace function public.payment_claim_webhook_processing_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_rows jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_webhook_processing_batch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('webhook_processing_batch_size', 25)
    ),
    1
  );

  drop table if exists _payment_webhook_claim_batch;

  create temp table _payment_webhook_claim_batch on commit drop as
  with eligible as (
    select q.id
    from public.payment_webhook_processing_queue q
    inner join public.payment_webhook_events e on e.id = q.webhook_event_id
    where q.state = 'PENDING'::public.payment_webhook_queue_state
      and q.scheduled_at <= now()
      and e.signature_validated
    order by q.scheduled_at
    limit v_batch_size
    for update of q skip locked
  ),
  claimed as (
    update public.payment_webhook_processing_queue q
    set
      state = 'PROCESSING'::public.payment_webhook_queue_state,
      attempted_at = now(),
      attempt_count = q.attempt_count + 1
    from eligible el
    where q.id = el.id
    returning
      q.id as queue_id,
      q.webhook_event_id,
      q.gateway_slug,
      q.event_type,
      q.attempt_count
  )
  select
    c.queue_id,
    c.webhook_event_id,
    c.gateway_slug,
    c.event_type,
    c.attempt_count,
    e.gateway_event_id,
    e.retry_count,
    e.failure_reason,
    e.state as event_state
  from claimed c
  join public.payment_webhook_events e on e.id = c.webhook_event_id;

  update public.payment_webhook_events e
  set state = 'PROCESSING'::public.payment_webhook_event_state
  from _payment_webhook_claim_batch b
  where e.id = b.webhook_event_id
    and e.state in (
      'RECEIVED'::public.payment_webhook_event_state,
      'VALIDATING'::public.payment_webhook_event_state,
      'FAILED'::public.payment_webhook_event_state,
      'PROCESSING'::public.payment_webhook_event_state
    );

  update _payment_webhook_claim_batch b
  set event_state = e.state
  from public.payment_webhook_events e
  where e.id = b.webhook_event_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', 'processing_queue',
        'queue_id', b.queue_id,
        'event_id', b.webhook_event_id,
        'gateway_slug', b.gateway_slug,
        'event_type', b.event_type,
        'attempt_count', b.attempt_count,
        'gateway_event_id', b.gateway_event_id,
        'retry_count', b.retry_count,
        'failure_reason', b.failure_reason,
        'event_state', b.event_state
      )
      order by b.queue_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from _payment_webhook_claim_batch b;

  return v_rows;
end;
$$;

comment on function public.payment_claim_webhook_processing_batch(int) is
  'Claims PENDING webhook queue rows with SKIP LOCKED; parent events move to PROCESSING (service_role only).';

revoke all on function public.payment_claim_webhook_processing_batch(int) from public;
revoke all on function public.payment_claim_webhook_processing_batch(int) from anon;
revoke all on function public.payment_claim_webhook_processing_batch(int) from authenticated;

grant execute on function public.payment_claim_webhook_processing_batch(int) to service_role;
