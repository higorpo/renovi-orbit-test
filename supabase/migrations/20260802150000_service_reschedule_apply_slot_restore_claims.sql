-- Fix: _cns_apply_service_reschedule_slot elevated to service_role by overwriting
-- request.jwt.claims for the rest of the transaction, wiping the actor sub claim.
-- Callers (e.g. cns_accept_service_reschedule) then failed on idempotency_commit
-- with "Authentication required" because auth.uid() became null.
-- Restore the original claims right after the payment call.

create or replace function public._cns_apply_service_reschedule_slot(
  p_contracted_service_id uuid,
  p_new_slot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_shift text;
  v_start_date date;
  v_end_date date;
  v_payment jsonb;
  v_elevated boolean := false;
  v_prev_claims text;
  v_prev_claim_role text;
begin
  perform public._cns_validate_reschedule_slot(p_new_slot);

  v_shift := nullif(btrim(p_new_slot->>'shift'), '');
  v_start_date := (p_new_slot->>'start_date')::date;
  v_end_date := nullif(btrim(p_new_slot->>'end_date'), '')::date;

  update public.contracted_services cs
  set
    scheduled_start_date = v_start_date,
    scheduled_end_date = v_end_date,
    scheduled_shift = v_shift,
    agreed_slot = p_new_slot,
    updated_at = now()
  where cs.id = p_contracted_service_id
  returning * into v_cs;

  if coalesce(auth.role(), '') <> 'service_role' then
    v_elevated := true;
    v_prev_claims := current_setting('request.jwt.claims', true);
    v_prev_claim_role := current_setting('request.jwt.claim.role', true);

    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );
  end if;

  begin
    v_payment := public.payment_reschedule_charge_date(p_contracted_service_id);
  exception
    when others then
      if v_elevated then
        perform set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
        perform set_config('request.jwt.claim.role', coalesce(v_prev_claim_role, ''), true);
      end if;
      raise;
  end;

  if v_elevated then
    perform set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(v_prev_claim_role, ''), true);
  end if;

  return jsonb_build_object(
    'contracted_service_id', p_contracted_service_id,
    'scheduled_start_date', v_cs.scheduled_start_date,
    'scheduled_end_date', v_cs.scheduled_end_date,
    'scheduled_shift', v_cs.scheduled_shift,
    'agreed_slot', v_cs.agreed_slot,
    'service_status', v_cs.status,
    'payment', v_payment
  );
end;
$$;

comment on function public._cns_apply_service_reschedule_slot(uuid, jsonb) is
  'Applies accepted reschedule slot to contracted_services and recomputes charge date; restores actor JWT claims after service_role elevation.';

revoke all on function public._cns_apply_service_reschedule_slot(uuid, jsonb) from public, anon, authenticated;
grant execute on function public._cns_apply_service_reschedule_slot(uuid, jsonb) to service_role;
