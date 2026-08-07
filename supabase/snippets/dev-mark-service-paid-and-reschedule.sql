-- Local/dev helper: mark contracted service as paid (CONFIRMED) and move the
-- scheduled execution date (default: today in America/Sao_Paulo).
--
-- Paste into Studio SQL (http://127.0.0.1:54323) or run via:
--   docker exec -i supabase_db_<ref> psql -U postgres -d postgres -f -
--
-- Edit the two constants in the DO block before running.
--
-- Notes:
-- - App URLs usually expose service_request_id; payment rows hang off contracted_services.
-- - payment_schedules FSM allows SCHEDULED/FAILED/... → PAID; trigger requires paid_amount.
-- - service_execution_at is GENERATED — do not UPDATE it; it follows scheduled_* / agreed_slot.
-- - Does NOT call NetCred (local seed only). Idempotent if already PAID/CONFIRMED.

BEGIN;

DO $$
DECLARE
  -- ========= edit these =========
  v_service_request_id uuid := '8017e006-5a32-44e7-b8da-1727a14f4d06';
  -- NULL = today (BRT). Or set e.g. DATE '2026-08-07'
  v_scheduled_date date := NULL;
  -- ==============================

  v_cs_id uuid;
  v_ps_id uuid;
  v_ps_state public.payment_schedule_state;
  v_cs_status public.contracted_service_status;
  v_paid_amount numeric;
BEGIN
  IF v_scheduled_date IS NULL THEN
    v_scheduled_date := (now() at time zone 'America/Sao_Paulo')::date;
  END IF;

  SELECT
    cs.id,
    cs.status,
    ps.id,
    ps.state
  INTO
    v_cs_id,
    v_cs_status,
    v_ps_id,
    v_ps_state
  FROM public.contracted_services cs
  JOIN public.payment_schedules ps
    ON ps.contracted_service_id = cs.id
   AND ps.state NOT IN (
     'REFUNDED'::public.payment_schedule_state,
     'PARTIALLY_REFUNDED'::public.payment_schedule_state,
     'CANCELLED'::public.payment_schedule_state,
     'VOIDED'::public.payment_schedule_state,
     'EXPIRED'::public.payment_schedule_state
   )
  WHERE cs.service_request_id = v_service_request_id
  ORDER BY ps.created_at DESC
  LIMIT 1;

  IF v_cs_id IS NULL THEN
    RAISE EXCEPTION
      'DEV_TARGET_NOT_FOUND: no contracted_services + active payment_schedules for service_request_id=%',
      v_service_request_id;
  END IF;

  IF v_ps_state NOT IN (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state,
    'PROCESSING'::public.payment_schedule_state,
    'IN_ANALYSIS'::public.payment_schedule_state,
    'PAID'::public.payment_schedule_state
  ) THEN
    RAISE EXCEPTION 'DEV_PAYMENT_STATE_UNSUPPORTED: % (cs=%)', v_ps_state, v_cs_id;
  END IF;

  -- Same gross-up path used when committing a charge (card brand may be null → fallback formula).
  SELECT public.payment_total_with_card_fees(
    ps.base_amount,
    (SELECT cct.card_brand FROM public.client_card_tokens cct WHERE cct.id = ps.client_card_token_id),
    ps.installment_number
  )
  INTO v_paid_amount
  FROM public.payment_schedules ps
  WHERE ps.id = v_ps_id;

  IF v_ps_state IS DISTINCT FROM 'PAID'::public.payment_schedule_state THEN
    UPDATE public.payment_schedules ps
    SET
      state = 'PAID',
      paid_at = coalesce(ps.paid_at, now()),
      paid_amount = coalesce(ps.paid_amount, v_paid_amount),
      claimed_charge_amount = coalesce(ps.claimed_charge_amount, v_paid_amount),
      gateway_charge_id = coalesce(ps.gateway_charge_id, 'local-dev-charge-' || ps.id::text),
      gateway_transaction_id = coalesce(ps.gateway_transaction_id, 'local-dev-tx-' || ps.id::text),
      locked_until = null,
      next_retry_at = null,
      failure_code = null,
      failure_reason = null
    WHERE ps.id = v_ps_id;
  END IF;

  UPDATE public.contracted_services cs
  SET
    status = CASE
      WHEN cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
        THEN 'CONFIRMED'::public.contracted_service_status
      ELSE cs.status
    END,
    scheduled_start_date = v_scheduled_date,
    agreed_slot = jsonb_set(
      coalesce(cs.agreed_slot, '{}'::jsonb),
      '{start_date}',
      to_jsonb(to_char(v_scheduled_date, 'YYYY-MM-DD')),
      true
    )
  WHERE cs.id = v_cs_id;

  RAISE NOTICE 'OK cs=% status %→CONFIRMED (if was PENDING_PAYMENT); schedule=%; payment %→PAID',
    v_cs_id, v_cs_status, v_scheduled_date, v_ps_state;
END $$;

-- Verify (edit the UUID if you changed the DO block constant)
SELECT
  cs.id AS contracted_service_id,
  cs.service_request_id,
  cs.status,
  cs.scheduled_start_date,
  cs.service_execution_at,
  cs.agreed_slot,
  ps.state AS payment_state,
  ps.paid_at,
  ps.paid_amount
FROM public.contracted_services cs
JOIN public.payment_schedules ps ON ps.contracted_service_id = cs.id
WHERE cs.service_request_id = '8017e006-5a32-44e7-b8da-1727a14f4d06';

COMMIT;
