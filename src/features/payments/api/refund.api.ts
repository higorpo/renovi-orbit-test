import { logger } from "@/lib/logger";
import { invokePaymentEdgeFunction, mapEdgeErrorPayload } from "./paymentApiClient";
import { PAYMENT_EDGE } from "./payments.edge";
import { mapCancellationErrorMessage } from "../utils/mapCancellationError";

export type ProcessRefundOutcome = "PRE_CHARGE_CANCELLED" | "REFUND_SUBMITTED";

export type ProcessRefundSuccess = {
  scheduleId: string;
  outcome: ProcessRefundOutcome;
  refundAmount?: string;
  penaltyTier?: string | null;
  expectedDays?: string;
};

export type ProcessRefundResult = {
  data: ProcessRefundSuccess | null;
  error: string | null;
  errorCode?: string;
  status?: number;
};

export async function processContractedServiceRefund(request: {
  contractedServiceId: string;
  cancellationReason?: string;
}): Promise<ProcessRefundResult> {
  const { ok, status, payload } = await invokePaymentEdgeFunction(
    PAYMENT_EDGE.processRefund,
    {
      service_id: request.contractedServiceId,
      cancellation_reason: request.cancellationReason ?? "CLIENT_INITIATED",
    },
  );

  if (!ok) {
    const { message, errorCode } = mapEdgeErrorPayload(payload, "Falha ao cancelar serviço");

    logger.warn("process_refund_failed", {
      contractedServiceId: request.contractedServiceId,
      status,
      errorCode,
      error: message,
    });

    const resolvedCode = errorCode ?? message;
    return {
      data: null,
      error: mapCancellationErrorMessage(resolvedCode),
      errorCode: resolvedCode,
      status,
    };
  }

  if (payload.outcome === "PRE_CHARGE_CANCELLED") {
    return {
      data: {
        scheduleId: String(payload.schedule_id),
        outcome: "PRE_CHARGE_CANCELLED",
      },
      error: null,
    };
  }

  return {
    data: {
      scheduleId: String(payload.schedule_id),
      outcome: "REFUND_SUBMITTED",
      refundAmount: payload.refund_amount != null ? String(payload.refund_amount) : undefined,
      penaltyTier: payload.penalty_tier != null ? String(payload.penalty_tier) : null,
      expectedDays: payload.expected_days != null ? String(payload.expected_days) : undefined,
    },
    error: null,
  };
}
