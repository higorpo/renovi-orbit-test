-- Payment Task 16: payment history read models (design.md §3.13, §11.2).

create index payment_schedules_client_paid_history_idx
  on public.payment_schedules (client_id, paid_at desc)
  where state in (
    'PAID'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  );

create index payment_schedules_provider_paid_history_idx
  on public.payment_schedules (provider_id, paid_at desc)
  where state in (
    'PAID'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  );

create view public.client_payment_transactions_v
with (security_invoker = false) as
select
  ps.id as schedule_id,
  ps.contracted_service_id,
  ps.client_id,
  ps.paid_amount as amount_paid,
  ps.base_amount as service_amount,
  ps.installment_number,
  ps.paid_at,
  ps.refunded_amount,
  ps.refunded_at,
  ps.state,
  ps.is_disputed,
  ps.created_at
from public.payment_schedules ps
where (
    ps.client_id = (select auth.uid())
    or (select public.is_platform_admin())
  )
  and ps.paid_amount is not null
  and ps.state in (
    'PAID'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  );

comment on view public.client_payment_transactions_v is
  'Client payment history: paid_amount (total charged) and base_amount (service value). No provider_payout.';

create view public.provider_payment_receivables_v
with (security_invoker = false) as
select
  ps.id as schedule_id,
  ps.contracted_service_id,
  ps.provider_id,
  ps.provider_payout as amount_received_at_capture,
  case
    -- Clawback only after gateway confirmation (refunded_at). Expected amount may
    -- already be stored on REFUND_REQUESTED for client history display.
    when ps.paid_amount is not null
      and ps.paid_amount > 0
      and ps.refunded_amount is not null
      and ps.refunded_at is not null
      then ps.provider_payout
        - (ps.refunded_amount * ps.provider_payout / ps.paid_amount)
    else ps.provider_payout
  end as net_amount_received,
  ps.paid_at as received_at,
  ps.refunded_amount,
  ps.refunded_at,
  ps.state,
  ps.is_disputed,
  ps.created_at
from public.payment_schedules ps
where (
    ps.provider_id = (select auth.uid())
    or (select public.is_platform_admin())
  )
  and ps.provider_payout is not null
  and ps.paid_amount is not null
  and ps.state in (
    'PAID'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  );

comment on view public.provider_payment_receivables_v is
  'Provider receivables: provider_payout at capture and net after proportional refund. received_at = paid_at (capture), not bank settlement (~D+30).';

-- CHK-030 invariant: security_invoker=false so the view owner can project revoked
-- amount columns (base_amount/paid_amount/provider_payout) that authenticated cannot
-- SELECT directly on payment_schedules. Tenancy is enforced in the view WHERE clause
-- (owner via auth.uid() or is_platform_admin()). pgTAP covers stranger/owner/admin.

revoke all on public.client_payment_transactions_v from public;
revoke all on public.client_payment_transactions_v from anon;

revoke all on public.provider_payment_receivables_v from public;
revoke all on public.provider_payment_receivables_v from anon;

grant select on public.client_payment_transactions_v to authenticated;
grant select on public.provider_payment_receivables_v to authenticated;
