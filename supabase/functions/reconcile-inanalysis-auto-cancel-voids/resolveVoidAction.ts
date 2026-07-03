import type { GatewayTransactionState } from "../_shared/payment/types.ts";

export type VoidGatewayAction =
  | "void"
  | "defer_captured"
  | "already_terminal"
  | "retry";

export function resolveVoidGatewayAction(
  gatewayState: GatewayTransactionState | null | undefined,
): VoidGatewayAction {
  if (gatewayState == null) {
    return "retry";
  }

  if (gatewayState === "PAID") {
    return "defer_captured";
  }

  if (
    gatewayState === "VOIDED" ||
    gatewayState === "REJECTED" ||
    gatewayState === "CANCELLED" ||
    gatewayState === "EXPIRED" ||
    gatewayState === "REFUNDED" ||
    gatewayState === "PARTIALLY_REFUNDED"
  ) {
    return "already_terminal";
  }

  if (gatewayState === "IN_ANALYSIS" || gatewayState === "SCHEDULED") {
    return "void";
  }

  return "retry";
}
