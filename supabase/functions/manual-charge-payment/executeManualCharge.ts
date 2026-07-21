import { resolveChargeReferenceCode } from "../_shared/payment/chargeReferenceCode.ts";
import { resolveRejectedTransactionFailureCode } from "../_shared/payment/map-rejected-reason.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  GatewayTransactionState,
  GetTransactionResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import type { ManualChargeSchedule } from "./types.ts";

export type ExecuteManualChargeDeps = {
  getTransaction: PaymentProvider["getTransaction"];
  createCharge: PaymentProvider["createCharge"];
  rotateGatewayReference: (scheduleId: string) => Promise<string>;
  now?: () => number;
};

export type ExecuteManualChargeResult =
  | {
    kind: "reconciled";
    existing: GetTransactionResult;
  }
  | {
    kind: "charged";
    chargeResult: CreateChargeResult;
    gatewayLatencyMs: number;
    referenceCode: string;
  };

function isSafeToCommitWithoutNewCharge(
  state: GatewayTransactionState,
): boolean {
  return state === "PAID" || state === "IN_ANALYSIS";
}

function isSafeToRotateAndCreate(
  existing: GetTransactionResult | null,
): boolean {
  if (!existing) {
    return true;
  }
  return (
    existing.transactionState === "REJECTED" ||
    existing.transactionState === "VOIDED"
  );
}

function buildChargeResultFromExisting(
  existing: GetTransactionResult,
): CreateChargeResult {
  if (existing.transactionState === "PAID") {
    return {
      success: true,
      transactionState: "PAID",
      chargeId: existing.chargeId,
      transactionId: existing.transactionId,
    };
  }

  if (existing.transactionState === "IN_ANALYSIS") {
    return {
      success: true,
      transactionState: "IN_ANALYSIS",
      chargeId: existing.chargeId,
      transactionId: existing.transactionId,
    };
  }

  const message = existing.rejectedReason?.trim() ||
    `Existing transaction is ${existing.transactionState}`;
  const originalCode = existing.transactionState === "REJECTED"
    ? resolveRejectedTransactionFailureCode(existing.rejectedReason)
    : existing.transactionState;

  return {
    success: false,
    transactionState: existing.transactionState === "VOIDED" ||
        existing.transactionState === "REJECTED"
      ? existing.transactionState
      : "REJECTED",
    chargeId: existing.chargeId,
    transactionId: existing.transactionId,
    error: {
      code: "TERMINAL",
      message,
      originalCode,
    },
  };
}

export function toCreateChargeResultFromExisting(
  existing: GetTransactionResult,
): CreateChargeResult {
  return buildChargeResultFromExisting(existing);
}

/**
 * Manual charge path: reconcile prior reference before any rotate/createCharge.
 * PAID/IN_ANALYSIS → commit existing; rotate only for REJECTED/VOIDED/absent.
 */
export async function executeManualCharge(
  deps: ExecuteManualChargeDeps,
  schedule: ManualChargeSchedule,
  companyId: string,
  chargeInput: CreateChargeInput,
): Promise<ExecuteManualChargeResult> {
  const priorReferenceCode = resolveChargeReferenceCode({
    gatewayReferenceCode: schedule.gateway_reference_code,
    contractedServiceId: schedule.contracted_service_id,
  });

  const existing = await deps.getTransaction({
    referenceCode: priorReferenceCode,
    companyId,
  });

  if (existing && isSafeToCommitWithoutNewCharge(existing.transactionState)) {
    return { kind: "reconciled", existing };
  }

  if (!isSafeToRotateAndCreate(existing)) {
    // Unexpected gateway state — do not create a second charge.
    return { kind: "reconciled", existing: existing! };
  }

  const referenceCode = await deps.rotateGatewayReference(schedule.id);
  const startedAt = deps.now?.() ?? Date.now();
  const chargeResult = await deps.createCharge({
    ...chargeInput,
    referenceCode,
  });
  const gatewayLatencyMs = Math.max(0, (deps.now?.() ?? Date.now()) - startedAt);

  if (chargeResult.error?.code === "REFERENCE_CODE_CONFLICT") {
    const conflicting = await deps.getTransaction({
      referenceCode,
      companyId,
    });

    if (
      conflicting &&
      (isSafeToCommitWithoutNewCharge(conflicting.transactionState) ||
        conflicting.transactionState === "REJECTED")
    ) {
      return { kind: "reconciled", existing: conflicting };
    }
  }

  return {
    kind: "charged",
    chargeResult,
    gatewayLatencyMs,
    referenceCode,
  };
}
