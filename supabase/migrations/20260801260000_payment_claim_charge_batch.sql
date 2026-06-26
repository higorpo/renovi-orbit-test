-- Payment Task 28: payment_claim_charge_batch RPC (design.md §4.5.1).

create or replace function public.payment_claim_charge_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_lease_minutes int;
  v_max_attempts int;
  v_rows jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_charge_batch'
      using errcode = '42501';
  end if;

  v_batch_size := coalesce(
    p_batch_size,
    public.platform_constant_int('charge_batch_size', 10)
  );
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);
  v_max_attempts := public.platform_constant_int('max_charge_attempts', 3);

  with eligible as materialized (
    select
      ps.id,
      ps.state as from_state,
      ps.contracted_service_id,
      ps.client_id,
      ps.provider_id,
      ps.gateway_slug,
      ps.client_card_token_id,
      ps.installment_number,
      ps.base_amount,
      ps.automatic_attempt_count,
      ps.max_attempts,
      ps.clearsale_session_id,
      ps.client_ip_address,
      public.payment_total_with_card_fees(
        ps.base_amount,
        cct.card_brand,
        ps.installment_number
      ) as charge_amount
    from public.payment_schedules ps
    join public.contracted_services cs on cs.id = ps.contracted_service_id
    join public.client_card_tokens cct
      on cct.id = ps.client_card_token_id
     and cct.state = 'ACTIVE'::public.payment_client_card_token_state
     and cct.client_id = ps.client_id
     and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
     and pga.gateway_slug = ps.gateway_slug
     and pga.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    where ps.state in ('SCHEDULED', 'FAILED')
      and ps.automatic_attempt_count < v_max_attempts
      and ps.charge_scheduled_at <= now()
      and (ps.locked_until is null or ps.locked_until < now())
      and (ps.next_retry_at is null or ps.next_retry_at <= now())
      and cs.status not in ('CANCELLED', 'COMPLETED')
    order by ps.charge_scheduled_at
    limit v_batch_size
    for update of ps skip locked
  ),
  claimed as (
    update public.payment_schedules ps
    set
      state = 'PROCESSING',
      locked_until = now() + make_interval(mins => v_lease_minutes),
      automatic_attempt_count = ps.automatic_attempt_count + 1,
      updated_at = now()
    from eligible e
    where ps.id = e.id
    returning
      ps.id,
      e.contracted_service_id,
      e.client_id,
      e.provider_id,
      e.gateway_slug,
      e.client_card_token_id,
      e.installment_number,
      e.base_amount,
      ps.automatic_attempt_count,
      e.max_attempts,
      e.clearsale_session_id,
      e.client_ip_address,
      e.from_state,
      e.charge_amount
  ),
  audit_insert as (
    insert into public.payment_audit_log (
      event_type,
      entity_type,
      entity_id,
      service_id,
      schedule_id,
      from_state,
      to_state,
      actor,
      metadata
    )
    select
      'CHARGE_ATTEMPT_STARTED',
      'payment_schedule',
      c.id,
      c.contracted_service_id,
      c.id,
      c.from_state,
      'PROCESSING',
      'cron'::public.payment_audit_actor,
      jsonb_build_object(
        'automatic_attempt_count', c.automatic_attempt_count,
        'charge_amount', c.charge_amount
      )
    from claimed c
    returning 1
  )
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
  into v_rows
  from claimed c;

  return v_rows;
end;
$$;

comment on function public.payment_claim_charge_batch(int) is
  'Cron dequeue: SKIP LOCKED lease, increment automatic_attempt_count, return charge_amount per row.';

revoke all on function public.payment_claim_charge_batch(int) from public;
revoke all on function public.payment_claim_charge_batch(int) from anon;
revoke all on function public.payment_claim_charge_batch(int) from authenticated;

grant execute on function public.payment_claim_charge_batch(int) to service_role;
