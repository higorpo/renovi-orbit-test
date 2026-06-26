-- Payment Task 46: payment_notify_upcoming_charges_batch + confirm RPC (design.md §4.10, Req 33).

create or replace function public.payment_confirm_upcoming_charge_notified(
  p_schedule_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_confirm_upcoming_charge_notified'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  update public.payment_schedules ps
  set
    upcoming_charge_notified_at = now(),
    updated_at = now()
  where ps.id = p_schedule_id
    and ps.upcoming_charge_notified_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

comment on function public.payment_confirm_upcoming_charge_notified(uuid) is
  'Marks upcoming_charge_notified_at after successful MMD enqueue (service_role only).';

revoke all on function public.payment_confirm_upcoming_charge_notified(uuid) from public;
revoke all on function public.payment_confirm_upcoming_charge_notified(uuid) from anon;
revoke all on function public.payment_confirm_upcoming_charge_notified(uuid) from authenticated;

grant execute on function public.payment_confirm_upcoming_charge_notified(uuid) to service_role;

create or replace function public.payment_notify_upcoming_charges_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_claimed jsonb;
  v_item jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_errors int := 0;
  v_schedule_id uuid;
  v_token_id uuid;
  v_base_amount numeric;
  v_installment_number smallint;
  v_card_number_masked text;
  v_card_brand text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_notify_upcoming_charges_batch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('upcoming_charge_notification_batch_size', 100)
    ),
    1
  );
  v_claimed := public.payment_claim_upcoming_charge_notifications(v_batch_size);

  for v_item in
    select value
    from jsonb_array_elements(v_claimed)
  loop
    begin
      v_schedule_id := (v_item->>'schedule_id')::uuid;
      v_token_id := (v_item->>'client_card_token_id')::uuid;
      v_base_amount := (v_item->>'base_amount')::numeric;
      v_installment_number := (v_item->>'installment_number')::smallint;

      select cct.card_number_masked, cct.card_brand
      into v_card_number_masked, v_card_brand
      from public.client_card_tokens cct
      where cct.id = v_token_id;

      v_rows := v_rows || jsonb_build_array(
        v_item || jsonb_build_object(
          'charge_amount', public.payment_calculate_charge_amount(
            v_token_id,
            v_base_amount,
            v_installment_number
          ),
          'card_number_masked', v_card_number_masked,
          'card_brand', v_card_brand
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'payment_notify_upcoming_charges_batch row failed schedule_id=% sqlstate=% message=%',
          v_schedule_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'candidate_count', jsonb_array_length(v_rows),
    'candidates', v_rows,
    'errors_count', v_errors
  );
end;
$$;

comment on function public.payment_notify_upcoming_charges_batch(int) is
  'Claims upcoming-charge candidates and returns MMD payload; mark via payment_confirm_upcoming_charge_notified after enqueue.';

revoke all on function public.payment_notify_upcoming_charges_batch(int) from public;
revoke all on function public.payment_notify_upcoming_charges_batch(int) from anon;
revoke all on function public.payment_notify_upcoming_charges_batch(int) from authenticated;

grant execute on function public.payment_notify_upcoming_charges_batch(int) to service_role;
