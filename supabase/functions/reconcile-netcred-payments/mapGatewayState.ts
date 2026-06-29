import type { GetTransactionResult } from "../_shared/payment/types.ts";

export function mapGatewayState(
  transaction: GetTransactionResult | null,
): GetTransactionResult["transactionState"] | null {
  if (!transaction) {
    return null;
  }

  return transaction.transactionState;
}

export function resolveReconcileGatewayState(
  gatewayState: GetTransactionResult["transactionState"] | null,
  currentState: string,
): string | null {
  if (gatewayState === null) {
    return null;
  }

  if (gatewayState === "IN_ANALYSIS" && currentState === "IN_ANALYSIS") {
    return "IN_ANALYSIS";
  }

  if (
    gatewayState === "PAID" ||
    gatewayState === "REJECTED" ||
    gatewayState === "REFUNDED" ||
    gatewayState === "PARTIALLY_REFUNDED" ||
    (gatewayState === "IN_ANALYSIS" && currentState === "PROCESSING")
  ) {
    return gatewayState;
  }

  return null;
}
