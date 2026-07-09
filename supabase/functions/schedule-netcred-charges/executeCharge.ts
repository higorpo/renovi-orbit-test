import { resolveChargeReferenceCode } from "../_shared/payment/chargeReferenceCode.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  GetTransactionResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import type { CronChargeSchedule } from "./types.ts";

export type ExecuteChargeDeps = {
  getTransaction: PaymentProvider["getTransaction"];
  createCharge: PaymentProvider["createCharge"];
  now?: () => number;
};

export type ExecuteChargeResult =
  | {
    kind: "reconciled";
    existing: GetTransactionResult;
  }
  | {
    kind: "charged";
    chargeResult: CreateChargeResult;
    gatewayLatencyMs: number;
  };

function resolveExistingChargeState(
  state: GetTransactionResult["transactionState"],
): NonNullable<CreateChargeResult["transactionState"]> {
  if (state === "IN_ANALYSIS" || state === "VOIDED" || state === "REJECTED") {
    return state;
  }

  return "REJECTED";
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

  return {
    success: false,
    transactionState: resolveExistingChargeState(existing.transactionState),
    chargeId: existing.chargeId,
    transactionId: existing.transactionId,
    error: {
      code: "TERMINAL",
      message: `Existing transaction is ${existing.transactionState}`,
      originalCode: existing.transactionState,
    },
  };
}

function resolveCompanyId(schedule: CronChargeSchedule): string {
  const companyId = schedule.netcred_company_id?.trim();
  if (!companyId) {
    throw new Error("NETCRED_COMPANY_ID_REQUIRED");
  }
  return companyId;
}

async function lookupExistingTransaction(
  deps: ExecuteChargeDeps,
  schedule: CronChargeSchedule,
): Promise<GetTransactionResult | null> {
  return deps.getTransaction({
    referenceCode: resolveChargeReferenceCode({
      gatewayReferenceCode: schedule.gateway_reference_code,
      contractedServiceId: schedule.contracted_service_id,
    }),
    companyId: resolveCompanyId(schedule),
  });
}

export async function executeCharge(
  deps: ExecuteChargeDeps,
  schedule: CronChargeSchedule,
  chargeInput: CreateChargeInput,
): Promise<ExecuteChargeResult> {
  if (schedule.automatic_attempt_count > 1) {
    const existing = await lookupExistingTransaction(deps, schedule);

    if (
      existing?.transactionState === "PAID" ||
      existing?.transactionState === "REJECTED"
    ) {
      return { kind: "reconciled", existing };
    }
  }

  const startedAt = deps.now?.() ?? Date.now();
  const chargeResult = await deps.createCharge(chargeInput);
  const gatewayLatencyMs = Math.max(0, (deps.now?.() ?? Date.now()) - startedAt);

  if (chargeResult.error?.code === "REFERENCE_CODE_CONFLICT") {
    const conflicting = await lookupExistingTransaction(deps, schedule);

    if (
      conflicting?.transactionState === "PAID" ||
      conflicting?.transactionState === "REJECTED"
    ) {
      return { kind: "reconciled", existing: conflicting };
    }
  }

  return {
    kind: "charged",
    chargeResult,
    gatewayLatencyMs,
  };
}

export function toCreateChargeResult(
  existing: GetTransactionResult,
): CreateChargeResult {
  return buildChargeResultFromExisting(existing);
}
