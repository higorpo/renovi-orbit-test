import { classifyChargeError } from "../_shared/payment/error-classification.ts";
import type { CreateChargeResult } from "../_shared/payment/types.ts";
import type { ManualChargeOutcome } from "./types.ts";

export function resolveChargeOutcome(result: CreateChargeResult): ManualChargeOutcome {
  if (result.success && result.transactionState === "PAID") {
    return "PAID";
  }

  if (result.success && result.transactionState === "IN_ANALYSIS") {
    return "IN_ANALYSIS";
  }

  if (result.error && classifyChargeError(result.error) === "terminal") {
    return "FAILED_PERMANENT";
  }

  return "FAILED";
}
