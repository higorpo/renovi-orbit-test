-- PAID is not terminal: refunds move PAID → REFUND_REQUESTED (design.md §3.5).
-- The early terminal guard listed PAID and blocked the transition matrix below it.

create or replace function public.payment_schedules_guard_state_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or old.state is not distinct from new.state then
    return new;
  end if;

  if old.state in (
    'CANCELLED'::public.payment_schedule_state,
    'VOIDED'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'EXPIRED'::public.payment_schedule_state
  ) then
    raise exception 'PAYMENT_SCHEDULE_TERMINAL_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PAYMENT_SCHEDULE_TERMINAL_STATE',
          'from_state', old.state,
          'to_state', new.state
        )::text;
  end if;

  if not (
    (old.state = 'SCHEDULED'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'EXPIRED'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'FAILED'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'PROCESSING'::public.payment_schedule_state
      and new.state in (
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'SCHEDULED'::public.payment_schedule_state
      ))
    or (old.state = 'IN_ANALYSIS'::public.payment_schedule_state
      and new.state in (
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'FAILED_PERMANENT'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'PAID'::public.payment_schedule_state
      and new.state in (
        'REFUND_REQUESTED'::public.payment_schedule_state,
        'VOIDED'::public.payment_schedule_state,
        -- External gateway refund / chargeback while still PAID (CHK-010).
        'REFUNDED'::public.payment_schedule_state,
        'PARTIALLY_REFUNDED'::public.payment_schedule_state
      ))
    or (old.state = 'REFUND_REQUESTED'::public.payment_schedule_state
      and new.state in (
        'REFUNDED'::public.payment_schedule_state,
        'PARTIALLY_REFUNDED'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state
      ))
    or (old.state = 'PARTIALLY_REFUNDED'::public.payment_schedule_state
      and new.state in (
        'REFUNDED'::public.payment_schedule_state,
        'REFUND_REQUESTED'::public.payment_schedule_state
      ))
  ) then
    raise exception 'PAYMENT_SCHEDULE_INVALID_TRANSITION'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PAYMENT_SCHEDULE_INVALID_TRANSITION',
          'from_state', old.state,
          'to_state', new.state
        )::text;
  end if;

  if new.state = 'PAID'::public.payment_schedule_state then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.paid_amount is null then
      raise exception 'PAYMENT_SCHEDULE_PAID_AMOUNT_REQUIRED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PAYMENT_SCHEDULE_PAID_AMOUNT_REQUIRED')::text;
    end if;
  end if;

  if new.state = 'FAILED_PERMANENT'::public.payment_schedule_state
    and new.failed_permanently_at is null then
    new.failed_permanently_at := now();
  end if;

  return new;
end;
$$;

comment on function public.payment_schedules_guard_state_transition() is
  'Enforces payment_schedules.state transition matrix. PAID may move to REFUND_REQUESTED, VOIDED, REFUNDED, or PARTIALLY_REFUNDED; truly terminal states cannot change.';
