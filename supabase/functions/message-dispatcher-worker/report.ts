import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyProviderFailure } from "./httpClassifier.ts";
import type { CheckoutDeliveryDto } from "./types.ts";

export interface PushDeliverySendResult {
  delivery: CheckoutDeliveryDto;
  ok: boolean;
  httpStatus: number;
  errorCode?: string;
}

export interface ReportDeliveryOutcomeInput {
  dispatchId: string;
  workerId: string;
  channel: "email" | "push";
  success: boolean;
  vendorMessageId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorBody?: string | null;
  retryable?: boolean;
  deliveries?: Array<{
    delivery_id: string;
    device_id?: string;
    outcome: "sent" | "failed_retryable" | "failed_terminal";
    vendor_error_code?: string | null;
  }>;
}

export interface ReportDeliveryOutcomeResult {
  applied: boolean;
  status?: string;
  reason?: string;
}

export function buildDeliveryReportPayload(
  deliveries: CheckoutDeliveryDto[],
): ReportDeliveryOutcomeInput["deliveries"] {
  return deliveries.map((d) => ({
    delivery_id: d.delivery_id,
    device_id: d.device_id,
    outcome: "sent" as const,
    vendor_error_code: null,
  }));
}

export function buildFailedDeliveryReportPayload(
  deliveries: CheckoutDeliveryDto[],
  vendorErrorCode: string,
  outcome: "failed_retryable" | "failed_terminal" = "failed_terminal",
): ReportDeliveryOutcomeInput["deliveries"] {
  return deliveries.map((d) => ({
    delivery_id: d.delivery_id,
    device_id: d.device_id,
    outcome,
    vendor_error_code: vendorErrorCode,
  }));
}

/** Per-device outcomes for push fan-out (design §8.4, task 67). */
export function buildPushDeliveryReportPayload(
  results: PushDeliverySendResult[],
): ReportDeliveryOutcomeInput["deliveries"] {
  return results.map((result) => {
    if (result.ok) {
      return {
        delivery_id: result.delivery.delivery_id,
        device_id: result.delivery.device_id,
        outcome: "sent" as const,
        vendor_error_code: null,
      };
    }

    const classified = classifyProviderFailure(
      "push",
      result.httpStatus,
      result.errorCode,
    );

    return {
      delivery_id: result.delivery.delivery_id,
      device_id: result.delivery.device_id,
      outcome: classified.retryable
        ? "failed_retryable" as const
        : "failed_terminal" as const,
      vendor_error_code: classified.errorCode,
    };
  });
}

export async function reportDeliveryOutcome(
  supabase: SupabaseClient,
  input: ReportDeliveryOutcomeInput,
): Promise<ReportDeliveryOutcomeResult> {
  const { data, error } = await supabase.schema("message_dispatcher").rpc(
    "message_dispatcher_report_delivery_outcome",
    {
      p_dispatch_id: input.dispatchId,
      p_worker_id: input.workerId,
      p_channel: input.channel,
      p_success: input.success,
      p_vendor_message_id: input.vendorMessageId ?? null,
      p_http_status: input.httpStatus ?? null,
      p_error_code: input.errorCode ?? null,
      p_error_body: input.errorBody ?? null,
      p_deliveries: input.deliveries ?? [],
      p_retryable: input.retryable ?? false,
    },
  );

  if (error) {
    throw new Error(`report_delivery_outcome failed: ${error.message}`);
  }

  const row = data as ReportDeliveryOutcomeResult;
  return {
    applied: Boolean(row.applied),
    status: row.status,
    reason: row.reason,
  };
}
