import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import type { GetTransactionResult, PaymentProvider } from "../_shared/payment/types.ts";
import { resolveVoidGatewayAction } from "./resolveVoidAction.ts";
import type {
  InanalysisVoidSchedule,
  ProcessedVoidResult,
  VoidCommitOutcome,
} from "./types.ts";

const logger = createPaymentLogger("reconcile-inanalysis-auto-cancel-voids");

export type ProcessInanalysisVoidDeps = {
  getTransaction: PaymentProvider["getTransaction"];
  voidCharge: PaymentProvider["voidCharge"];
  commitOutcome: (input: {
    scheduleId: string;
    outcome: VoidCommitOutcome;
    gatewayState?: string;
    errorMessage?: string;
  }) => Promise<{ applied: boolean; reconciliation_failure_count?: number }>;
  emitWarning: (extra: Record<string, unknown>) => void;
};

export async function processInanalysisVoidSchedule(
  deps: ProcessInanalysisVoidDeps,
  schedule: InanalysisVoidSchedule,
): Promise<ProcessedVoidResult> {
  const companyId = schedule.netcred_company_id?.trim();
  if (!companyId) {
    const commit = await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "failed",
      errorMessage: "NETCRED_COMPANY_ID_REQUIRED",
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount: commit.reconciliation_failure_count,
    };
  }

  let transaction: GetTransactionResult | null;

  try {
    transaction = await deps.getTransaction({
      referenceCode: schedule.contracted_service_id,
      companyId,
    });
  } catch (error) {
    const commit = await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    logger.warn("inanalysis_void_get_transaction_failed", {
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount: commit.reconciliation_failure_count,
    };
  }

  const gatewayState = transaction?.transactionState ?? null;
  const action = resolveVoidGatewayAction(gatewayState);

  if (action === "defer_captured") {
    await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "deferred_captured",
      gatewayState: gatewayState ?? undefined,
    });

    deps.emitWarning({
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
      reason: "gateway_already_captured",
      gateway_state: gatewayState,
    });

    return {
      scheduleId: schedule.id,
      outcome: "DEFERRED",
    };
  }

  if (action === "already_terminal") {
    await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "already_terminal",
      gatewayState: gatewayState ?? undefined,
    });

    return {
      scheduleId: schedule.id,
      outcome: "ALREADY_TERMINAL",
    };
  }

  if (action === "retry") {
    const commit = await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "failed",
      gatewayState: gatewayState ?? undefined,
      errorMessage: gatewayState == null
        ? "gateway_state_missing"
        : `unsupported_gateway_state:${gatewayState}`,
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount: commit.reconciliation_failure_count,
    };
  }

  const chargeId = schedule.gateway_charge_id?.trim();
  if (!chargeId) {
    const commit = await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "failed",
      gatewayState: gatewayState ?? undefined,
      errorMessage: "gateway_charge_id_missing",
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount: commit.reconciliation_failure_count,
    };
  }

  const voidResult = await deps.voidCharge({ chargeId });

  if (!voidResult.success) {
    const commit = await deps.commitOutcome({
      scheduleId: schedule.id,
      outcome: "failed",
      gatewayState: gatewayState ?? undefined,
      errorMessage: voidResult.error?.message ?? "charge_void_failed",
    });

    logger.warn("inanalysis_void_charge_failed", {
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
      error_code: voidResult.error?.code,
      error_message: voidResult.error?.message,
    });

    return {
      scheduleId: schedule.id,
      outcome: "FAILURE",
      failureCount: commit.reconciliation_failure_count,
    };
  }

  await deps.commitOutcome({
    scheduleId: schedule.id,
    outcome: "voided",
    gatewayState: gatewayState ?? undefined,
  });

  return {
    scheduleId: schedule.id,
    outcome: "VOIDED",
  };
}
