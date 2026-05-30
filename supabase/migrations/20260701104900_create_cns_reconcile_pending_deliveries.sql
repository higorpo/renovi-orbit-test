-- CNS Phase 5 — task 51: stale delivery_status reconcile (design §6.1, §8.1, Req. 26, R26-AC01, R13-AC03).
-- Migration order: runs AFTER task 4 (chat_messages).

create index if not exists chat_messages_pending_delivery_idx
  on public.chat_messages (created_at)
  where delivery_status = 'PENDING'::public.cns_delivery_status;

comment on index public.chat_messages_pending_delivery_idx is
  'Supports cns_reconcile_pending_deliveries: stale PENDING messages older than 5 minutes.';

create or replace function public.cns_reconcile_pending_deliveries(
  p_batch_size int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_processed int := 0;
  v_reconciled int := 0;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  with candidates as (
    select m.id
    from public.chat_messages m
    where m.delivery_status = 'PENDING'::public.cns_delivery_status
      and m.created_at < now() - interval '5 minutes'
    order by m.created_at
    for update of m skip locked
    limit p_batch_size
  )
  update public.chat_messages m
  set
    delivery_status = 'FAILED'::public.cns_delivery_status,
    updated_at = now()
  from candidates c
  where m.id = c.id
    and m.delivery_status = 'PENDING'::public.cns_delivery_status;

  get diagnostics v_reconciled = row_count;
  v_processed := v_reconciled;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_reconciled > 0 then
    raise log 'cns_delivery_reconcile_total reconciled=% processed=%',
      v_reconciled,
      v_processed;
  end if;

  return jsonb_build_object(
    'processed_count', v_processed,
    'reconciled_count', v_reconciled,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_reconcile_pending_deliveries(int) is
  'Optional batch: mark stale PENDING chat_messages as FAILED after 5 minutes; reconcile only, no resend (R26-AC01, R13-AC03).';

revoke all on function public.cns_reconcile_pending_deliveries(int) from public;
revoke all on function public.cns_reconcile_pending_deliveries(int) from authenticated;
revoke all on function public.cns_reconcile_pending_deliveries(int) from anon;

grant execute on function public.cns_reconcile_pending_deliveries(int) to service_role;
