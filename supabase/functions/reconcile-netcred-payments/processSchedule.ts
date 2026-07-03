import type { GetTransactionResult, PaymentProvider } from "../_shared/payment/types.ts";
import { resolveReconcileGatewayState } from "./mapGatewayState.ts";
import type {
  ProcessedReconcileResult,
  ReconcileApplyResult,
  ReconcileSchedule,
} from "./types.ts";

export type ProcessReconcileScheduleDeps = {
  getTransaction: PaymentProvider["getTransaction"];
  applyGatewayState: (input: {
    scheduleId: string;
    gatewayState: string;
    paidAmount?: string;
    refundedAmount?: string;
    providerChargeId?: string;
    providerTransactionId?: string;
  }) => Promise<ReconcileApplyResult>;
  incrementFailureCount: (scheduleId: string) => Promise<number>;
  emitWarning: (extra: Record<string, unknown>) => void;
};

function outcomeFromApplyResult(result: ReconcileApplyResult): ProcessedReconcileResult["outcome"] {
  if (!result.applied) {
    if (result.reason === "still_in_analysis") {
      return "SKIPPED";
    }
    return "SKIPPED";
  }

  switch (result.to_state) {
    case "PAID":
      return "PAID";
    case "FAILED_PERMANENT":
      return "FAILED_PERMANENT";
    case "REFUNDED":
      return "REFUNDED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "IN_ANALYSIS":
      return "IN_ANALYSIS";
    default:
      return "SKIPPED";
  }
}

export async function processReconcileSchedule(
  deps: ProcessReconcileScheduleDeps,
  schedule: ReconcileSchedule,
): Promise<ProcessedReconcileResult> {
  let transaction: GetTransactionResult | null;

  try {
    const companyId = schedule.netcred_company_id?.trim();
    if (!companyId) {
      throw new Error("NETCRED_COMPANY_ID_REQUIRED");
    }

    transaction = await deps.getTransaction({
      referenceCode: schedule.contracted_service_id,
      companyId,
    });
  } catch (error) {
    const failureCount = await deps.incrementFailureCount(schedule.id);
    deps.emitWarning({
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
      reason: "network_error",
      reconciliation_failure_count: failureCount,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount,
    };
  }

  const gatewayState = resolveReconcileGatewayState(
    transaction?.transactionState ?? null,
    schedule.state,
  );

  if (gatewayState === null) {
    const failureCount = await deps.incrementFailureCount(schedule.id);
    if (failureCount > 3) {
      deps.emitWarning({
        schedule_id: schedule.id,
        service_id: schedule.contracted_service_id,
        reason: "gateway_null",
        reconciliation_failure_count: failureCount,
      });
    }

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount,
    };
  }

  if (gatewayState === "IN_ANALYSIS" && schedule.state === "IN_ANALYSIS") {
    return {
      scheduleId: schedule.id,
      outcome: "SKIPPED",
      failureCount: schedule.reconciliation_failure_count,
    };
  }

  const applyResult = await deps.applyGatewayState({
    scheduleId: schedule.id,
    gatewayState,
    paidAmount: transaction?.paidAmount,
    refundedAmount: transaction?.refundedAmount,
    providerChargeId: transaction?.chargeId,
    providerTransactionId: transaction?.transactionId,
  });

  if (!applyResult.applied) {
    return {
      scheduleId: schedule.id,
      outcome: "SKIPPED",
      failureCount: applyResult.reconciliation_failure_count,
    };
  }

  return {
    scheduleId: schedule.id,
    outcome: outcomeFromApplyResult(applyResult),
    chargeAmount: applyResult.charge_amount
      ? Number(applyResult.charge_amount).toFixed(2)
      : undefined,
  };
}
