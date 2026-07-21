import type { CreateChargeResult } from "../_shared/payment/types.ts";
import type { CronChargeSchedule } from "./types.ts";

export function resolveGatewayReferenceCode(
  schedule: CronChargeSchedule,
): string {
  const trimmed = schedule.gateway_reference_code?.trim();
  return trimmed || schedule.contracted_service_id;
}

export function chargeResultLogFields(
  result: CreateChargeResult | undefined,
): Record<string, unknown> {
  if (!result) {
    return {};
  }

  const gatewayIds: Record<string, unknown> = {};
  if (result.chargeId) {
    gatewayIds.gateway_charge_id = result.chargeId;
  }

  if (result.success) {
    return gatewayIds;
  }

  return {
    ...gatewayIds,
    failure_code: result.error?.originalCode ?? result.error?.code ?? null,
    failure_reason: result.error?.message ?? null,
    gateway_error_class: result.error?.code ?? null,
    transaction_state: result.transactionState ?? null,
  };
}

export function buildProviderResponseSummary(
  result: CreateChargeResult,
): Record<string, unknown> {
  return {
    success: result.success,
    transactionState: result.transactionState ?? null,
    chargeId: result.chargeId ?? null,
    transactionId: result.transactionId ?? null,
    errorCode: result.error?.code ?? null,
    originalCode: result.error?.originalCode ?? null,
    errorMessage: result.error?.message ?? null,
  };
}

export function buildChargeAttemptCompletedFields(
  schedule: CronChargeSchedule,
  extra: Record<string, unknown>,
  chargeResult?: CreateChargeResult,
): Record<string, unknown> {
  return {
    service_id: schedule.contracted_service_id,
    schedule_id: schedule.id,
    gateway_slug: schedule.gateway_slug,
    initiator: "cron",
    attempt_number: schedule.automatic_attempt_count,
    gateway_reference_code: resolveGatewayReferenceCode(schedule),
    ...extra,
    ...chargeResultLogFields(chargeResult),
  };
}
