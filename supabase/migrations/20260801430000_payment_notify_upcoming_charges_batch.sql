-- Payment Task 45: payment_claim_upcoming_charge_notifications RPC (design.md §4.10, Req 33).
-- Canonical claim lives here; batch + confirm in task 46 migration.

create or replace function public.payment_claim_upcoming_charge_notifications(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_upcoming_charge_notifications'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('upcoming_charge_notification_batch_size', 100)
    ),
    1
  );

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'schedule_id', ps.id,
          'service_id', ps.contracted_service_id,
          'client_id', ps.client_id,
          'provider_id', ps.provider_id,
          'charge_scheduled_at', ps.charge_scheduled_at,
          'installment_number', ps.installment_number,
          'base_amount', ps.base_amount,
          'client_card_token_id', ps.client_card_token_id
        )
        order by ps.charge_scheduled_at, ps.id
      )
      from (
        select ps.*
        from public.payment_schedules ps
        inner join public.contracted_services cs on cs.id = ps.contracted_service_id
        where ps.state = 'SCHEDULED'::public.payment_schedule_state
          and ps.upcoming_charge_notified_at is null
          and ps.charge_scheduled_at - now() <= interval '24 hours'
          and ps.charge_scheduled_at > now()
          and ps.charge_scheduled_at >= now() + interval '1 hour'
          and ps.client_card_token_id is not null
          and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
        order by ps.charge_scheduled_at, ps.id
        limit v_batch_size
        for update of ps skip locked
      ) ps
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function public.payment_claim_upcoming_charge_notifications(int) is
  'SKIP LOCKED claim for pre-charge notification candidates; does not set upcoming_charge_notified_at.';

revoke all on function public.payment_claim_upcoming_charge_notifications(int) from public;
revoke all on function public.payment_claim_upcoming_charge_notifications(int) from anon;
revoke all on function public.payment_claim_upcoming_charge_notifications(int) from authenticated;

grant execute on function public.payment_claim_upcoming_charge_notifications(int) to service_role;
