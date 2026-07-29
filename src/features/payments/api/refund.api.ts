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
  supportUrl?: string;
};

function isRefundFailedPayload(payload: Record<string, unknown>): boolean {
  return (
    payload.error === "refund_failed" ||
    payload.refund_submit_status === "FAILED" ||
    payload.error_code === "refund_failed"
  );
}

function readSupportUrl(payload: Record<string, unknown>): string | undefined {
  return typeof payload.support_url === "string" && payload.support_url.trim()
    ? payload.support_url
    : undefined;
}

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

  // Gateway FAILED must never surface as toast success (CHK-008).
  if (!ok || isRefundFailedPayload(payload)) {
    const { message, errorCode } = mapEdgeErrorPayload(
      isRefundFailedPayload(payload) && ok
        ? { ...payload, error: "refund_failed", error_code: "refund_failed" }
        : payload,
      "Falha ao processar cancelamento/reembolso",
    );

    const resolvedCode =
      (isRefundFailedPayload(payload) ? "refund_failed" : null) ??
      errorCode ??
      message;

    const supportUrl = readSupportUrl(payload);

    logger.warn("process_refund_failed", {
      contractedServiceId: request.contractedServiceId,
      status: isRefundFailedPayload(payload) && ok ? 500 : status,
      errorCode: resolvedCode,
      error: message,
      refundSubmitStatus: payload.refund_submit_status,
      supportUrl,
    });

    return {
      data: null,
      error: mapCancellationErrorMessage(resolvedCode),
      errorCode: resolvedCode,
      status: isRefundFailedPayload(payload) && ok ? 500 : status,
      supportUrl,
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
