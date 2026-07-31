-- CLS alignment for payment_schedules_audit + revoke direct table access where app uses DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- 1) payment_schedules_audit — mirror payment_schedules CLS allowlist
-- Keep table-level SELECT for authenticated so admin UI (JWT + is_platform_admin RLS) works.
-- Revoke sensitive columns that authenticated cannot SELECT on payment_schedules.
-- ---------------------------------------------------------------------------
revoke all on table public.payment_schedules_audit from public;
revoke all on table public.payment_schedules_audit from anon;

revoke select on table public.payment_schedules_audit from authenticated;

grant select (
  -- Same allowlist as public.payment_schedules for authenticated
  id,
  contracted_service_id,
  client_id,
  provider_id,
  gateway_slug,
  installment_number,
  charge_scheduled_at,
  state,
  automatic_attempt_count,
  manual_attempt_count,
  max_attempts,
  upcoming_charge_notified_at,
  is_disputed,
  needs_payment_method_update,
  paid_at,
  failed_at,
  failed_permanently_at,
  cancelled_at,
  refunded_at,
  refunded_amount,
  failure_code,
  failure_reason,
  cancellation_reason,
  created_at,
  updated_at,
  -- Audit metadata (non-sensitive)
  audit_id,
  audit_op,
  audited_at,
  audited_by,
  audited_role,
  row_version,
  audit_txid
) on table public.payment_schedules_audit to authenticated;

grant select on table public.payment_schedules_audit to service_role;

revoke insert, update, delete, truncate on table public.payment_schedules_audit from public;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from anon;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from authenticated;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from service_role;

-- ---------------------------------------------------------------------------
-- 2) payment_settlement_movements — app reads via list_provider_settlement_movements (DEFINER)
-- Revoke all authenticated privileges including prior column-level SELECT allowlist.
-- DEFINER RPC still reads as owner; service_role retains full access.
-- ---------------------------------------------------------------------------
revoke all on table public.payment_settlement_movements from public;
revoke all on table public.payment_settlement_movements from anon;
revoke all on table public.payment_settlement_movements from authenticated;

grant select, insert, update, delete on table public.payment_settlement_movements to service_role;

-- ---------------------------------------------------------------------------
-- 3) provider_kyc_upload_sessions — app mutates via DEFINER RPCs only
-- ---------------------------------------------------------------------------
revoke all on table public.provider_kyc_upload_sessions from public;
revoke all on table public.provider_kyc_upload_sessions from anon;
revoke all on table public.provider_kyc_upload_sessions from authenticated;

grant select, insert, update, delete on table public.provider_kyc_upload_sessions to service_role;
