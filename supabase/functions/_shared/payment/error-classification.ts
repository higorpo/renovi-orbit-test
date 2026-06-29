import type { ChargeError } from "./types.ts";
import { TERMINAL_GATEWAY_ERROR_CODES } from "./netcred-charge-errors.ts";

export const TERMINAL_STATES = new Set([
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "VOIDED",
  "CANCELLED",
  "EXPIRED",
]);

export function classifyChargeError(error: ChargeError): "terminal" | "retryable" {
  if (error.code === "TERMINAL") return "terminal";
  if (error.code === "AUTH_FAILURE") return "retryable";
  if (TERMINAL_GATEWAY_ERROR_CODES.has(error.originalCode ?? "")) return "terminal";
  return "retryable";
}

export function isTerminalGatewayState(state: string): boolean {
  return TERMINAL_STATES.has(state);
}

export function isValidWebhookTransition(
  fromState: string,
  toState: string,
): boolean {
  if (TERMINAL_STATES.has(fromState) && fromState !== toState) {
    if (toState === "PAID" && fromState === "IN_ANALYSIS") return true;
    return false;
  }
  return true;
}
