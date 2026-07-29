export type RefundInitiator = "client" | "provider";

export type ProcessRefundBody = {
  service_id?: string;
  cancellation_reason?: string;
};

export type RefundContext = {
  serviceId: string;
  clientId: string;
  providerId: string;
  status: string;
  serviceScheduledAt: string | null;
  scheduleId: string;
  scheduleState: string;
  baseAmount: number;
  paidAmount: number | null;
  providerTransactionId: string | null;
  refundSubmitStatus: string | null;
};

export type RefundSubmitResult = {
  scheduleId: string;
  providerTransactionId: string;
  paidAmount: string;
  baseAmount: string;
  refundAmount: string;
  penaltyTier: string | null;
  alreadySubmitted: boolean;
  refundSubmitStatus?: string | null;
  path?: string | null;
};

export type ProcessRefundErrorCode =
  | "SERVICE_NOT_FOUND"
  | "SCHEDULE_NOT_FOUND"
  | "FORBIDDEN"
  | "SERVICE_NOT_CANCELLABLE"
  | "PAYMENT_IN_ANALYSIS"
  | "INVALID_SCHEDULE_STATE"
  | "TRANSACTION_NOT_FOUND"
  | "PAYMENT_SCHEDULE_TERMINAL_STATE"
  | "PAYMENT_SCHEDULE_INVALID_TRANSITION"
  | "INVALID_REFUND_AMOUNT";

export function resolveInitiator(
  userId: string,
  context: Pick<RefundContext, "clientId" | "providerId">,
): RefundInitiator | null {
  if (userId === context.clientId) {
    return "client";
  }

  if (userId === context.providerId) {
    return "provider";
  }

  return null;
}

export function isPreChargeState(state: string): boolean {
  return state === "SCHEDULED" || state === "FAILED" || state === "FAILED_PERMANENT";
}

export function isRefundGatewayAcked(status: string | null | undefined): boolean {
  return status === "SUBMITTED" || status === "CONFIRMED";
}
