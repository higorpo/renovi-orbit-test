-- Payment Task 39: payment_claim_stale_schedules_for_reconciliation RPC (design.md §4.9, Req 20 AC1).

create or replace function public.payment_claim_stale_schedules_for_reconciliation(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_stale_minutes int;
  v_lease_minutes int;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_stale_schedules_for_reconciliation'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('reconciliation_batch_size', 50)
    ),
    1
  );

  v_stale_minutes := public.platform_constant_int('reconciliation_poll_interval_minutes', 30);
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);

  for v_row in
    with eligible as (
      select ps.id
      from public.payment_schedules ps
      where ps.state in (
        'IN_ANALYSIS'::public.payment_schedule_state,
        'PROCESSING'::public.payment_schedule_state,
        'REFUND_REQUESTED'::public.payment_schedule_state
      )
        and ps.updated_at < now() - make_interval(mins => v_stale_minutes)
        and (ps.locked_until is null or ps.locked_until < now())
      order by ps.updated_at
      limit v_batch_size
      for update of ps skip locked
    ),
    claimed as (
      update public.payment_schedules ps
      set locked_until = now() + make_interval(mins => v_lease_minutes)
      from eligible el
      where ps.id = el.id
      returning
        ps.id,
        ps.contracted_service_id,
        ps.client_id,
        ps.provider_id,
        ps.state,
        ps.installment_number,
        ps.base_amount,
        ps.client_card_token_id,
        ps.gateway_charge_id,
        ps.gateway_transaction_id,
        ps.paid_amount,
        ps.refunded_amount,
        ps.automatic_attempt_count,
        ps.manual_attempt_count,
        ps.max_attempts,
        ps.reconciliation_failure_count,
        ps.updated_at
    )
    select * from claimed
  loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_row.id,
      'contracted_service_id', v_row.contracted_service_id,
      'reference_code', v_row.contracted_service_id,
      'client_id', v_row.client_id,
      'provider_id', v_row.provider_id,
      'state', v_row.state,
      'installment_number', v_row.installment_number,
      'base_amount', v_row.base_amount,
      'client_card_token_id', v_row.client_card_token_id,
      'gateway_charge_id', v_row.gateway_charge_id,
      'gateway_transaction_id', v_row.gateway_transaction_id,
      'paid_amount', v_row.paid_amount,
      'refunded_amount', v_row.refunded_amount,
      'automatic_attempt_count', v_row.automatic_attempt_count,
      'manual_attempt_count', v_row.manual_attempt_count,
      'max_attempts', v_row.max_attempts,
      'reconciliation_failure_count', v_row.reconciliation_failure_count,
      'updated_at', v_row.updated_at
    ));
  end loop;

  return v_rows;
end;
$$;

comment on function public.payment_claim_stale_schedules_for_reconciliation(int) is
  'Claims stale intermediate schedules for reconcile-netcred-payments EF (service_role only).';

revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from public;
revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from anon;
revoke all on function public.payment_claim_stale_schedules_for_reconciliation(int) from authenticated;

grant execute on function public.payment_claim_stale_schedules_for_reconciliation(int) to service_role;
