/**
 * Coarse client-facing payment error buckets (CHK-014 / CHK-036).
 * Fine gateway codes (RISK_ANALYSIS_*, REJECTED, …) stay in logs/DB only.
 */

import {
  RISK_ANALYSIS_FAILURE_CODES,
} from "./map-rejected-reason.ts";
import type { ChargeError } from "./types.ts";

export type ClientFacingChargeFailureCode =
  | "RETRYABLE"
  | "TERMINAL"
  | "RISK_REJECTED";

const RISK_ANALYSIS_CODE_SET = new Set<string>(RISK_ANALYSIS_FAILURE_CODES);

export function isRiskAnalysisFailureCode(
  code: string | null | undefined,
): boolean {
  if (!code?.trim()) return false;
  const upper = code.trim().toUpperCase();
  return RISK_ANALYSIS_CODE_SET.has(upper) ||
    upper.startsWith("RISK_ANALYSIS_");
}

/**
 * Maps a charge error to the opaque bucket returned to Edge clients.
 * Prefer `originalCode` for risk-analysis detection; never expose fine codes.
 */
export function toClientFacingChargeFailureCode(
  error: ChargeError | null | undefined,
): ClientFacingChargeFailureCode | null {
  if (!error) return null;

  if (
    isRiskAnalysisFailureCode(error.originalCode) ||
    isRiskAnalysisFailureCode(error.code)
  ) {
    return "RISK_REJECTED";
  }

  if (
    error.code === "RETRYABLE" ||
    error.code === "REFERENCE_CODE_CONFLICT" ||
    error.code === "AUTH_FAILURE"
  ) {
    return "RETRYABLE";
  }

  return "TERMINAL";
}

/** Opaque tokenize decline for clients; fine gateway codes stay in server logs. */
export function toOpaqueTokenizeClientError(): {
  message: string;
  code: "CARD_REJECTED";
} {
  return {
    message: "Card was rejected",
    code: "CARD_REJECTED",
  };
}
