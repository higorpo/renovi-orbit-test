import { classifyChargeError } from "../_shared/payment/error-classification.ts";
import type { CreateChargeResult } from "../_shared/payment/types.ts";
import type { CronChargeOutcome } from "./types.ts";

export function resolveCronChargeOutcome(
  result: CreateChargeResult,
  automaticAttemptCount: number,
  maxAttempts: number,
): { outcome: CronChargeOutcome; undoAttemptIncrement: boolean } {
  if (result.success && result.transactionState === "PAID") {
    return { outcome: "PAID", undoAttemptIncrement: false };
  }

  if (result.success && result.transactionState === "IN_ANALYSIS") {
    return { outcome: "IN_ANALYSIS", undoAttemptIncrement: false };
  }

  if (result.error && classifyChargeError(result.error) === "terminal") {
    return { outcome: "FAILED_PERMANENT", undoAttemptIncrement: true };
  }

  if (automaticAttemptCount >= maxAttempts) {
    return { outcome: "FAILED_PERMANENT", undoAttemptIncrement: false };
  }

  return { outcome: "FAILED", undoAttemptIncrement: false };
}
