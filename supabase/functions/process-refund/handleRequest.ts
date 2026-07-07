import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";
import type { PaymentProvider } from "../_shared/payment/types.ts";
import type {
  ProcessRefundBody,
  ProcessRefundErrorCode,
  RefundContext,
  RefundSubmitResult,
} from "./types.ts";
import { isPreChargeState, resolveInitiator } from "./types.ts";

const logger = createPaymentLogger("process-refund");
const RATE_LIMIT_CONFIG = { perMinute: 10, failClosed: true };
const EXPECTED_REFUND_DAYS = "30-60";

export type ProcessRefundDeps = {
  getUser: (token: string) => Promise<{ user: { id: string } | null; error: Error | null }>;
  loadRefundContext: (serviceId: string) => Promise<RefundContext | null>;
  preChargeCancel: (input: {
    serviceId: string;
    actorId: string;
    cancellationReason?: string;
    initiator: "client" | "provider";
  }) => Promise<string | ProcessRefundErrorCode>;
  submitRefundRequest: (input: {
    serviceId: string;
    actorId: string;
    cancellationReason?: string;
    initiator: "client" | "provider";
  }) => Promise<RefundSubmitResult | ProcessRefundErrorCode>;
  refundTransaction: PaymentProvider["refundTransaction"];
  recordRefundFailed: (input: {
    scheduleId: string;
    serviceId: string;
    actorId: string;
    initiator: "client" | "provider";
    errorMessage: string;
  }) => Promise<void>;
  captureCriticalError: (error: unknown, extra: Record<string, unknown>) => void;
  getSupportUrl: () => string;
  checkRateLimit: typeof checkRateLimit;
  now?: () => Date;
};

function mapErrorStatus(error: ProcessRefundErrorCode): number {
  switch (error) {
    case "SERVICE_NOT_FOUND":
    case "SCHEDULE_NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    default:
      return 409;
  }
}

function mapRpcError(message: string): ProcessRefundErrorCode | null {
  const known: ProcessRefundErrorCode[] = [
    "SERVICE_NOT_FOUND",
    "SCHEDULE_NOT_FOUND",
    "FORBIDDEN",
    "SERVICE_NOT_CANCELLABLE",
    "PAYMENT_IN_ANALYSIS",
    "INVALID_SCHEDULE_STATE",
    "TRANSACTION_NOT_FOUND",
    "PAYMENT_SCHEDULE_TERMINAL_STATE",
    "PAYMENT_SCHEDULE_INVALID_TRANSITION",
  ];

  return known.find((code) => message.includes(code)) ?? null;
}

export function mapRpcErrorCode(message: string): ProcessRefundErrorCode | null {
  return mapRpcError(message);
}

export async function handleProcessRefundRequest(
  req: Request,
  deps: ProcessRefundDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const token = authHeader.replace("Bearer ", "");
  const { user, error: authError } = await deps.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const clientIP = getClientIP(req);
  const rateLimit = await deps.checkRateLimit(
    clientIP,
    user.id,
    "process-refund",
    RATE_LIMIT_CONFIG,
  );

  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: "rate_limited",
        message: "Too many requests. Try again shortly.",
        retryAfter: rateLimit.retryAfter,
      },
      429,
      { ...cors, "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  let body: ProcessRefundBody;
  try {
    body = await req.json() as ProcessRefundBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const serviceId = body.service_id?.trim();
  if (!serviceId) {
    return jsonResponse({ error: "service_id is required" }, 400, cors);
  }

  const context = await deps.loadRefundContext(serviceId);
  if (!context) {
    return jsonResponse({ error_code: "SERVICE_NOT_FOUND" }, 404, cors);
  }

  const initiator = resolveInitiator(user.id, context);
  if (!initiator) {
    return jsonResponse({ error_code: "FORBIDDEN" }, 403, cors);
  }

  if (context.status === "COMPLETED") {
    return jsonResponse({ error_code: "SERVICE_NOT_CANCELLABLE" }, 409, cors);
  }

  if (context.scheduleState === "IN_ANALYSIS") {
    return jsonResponse({ error_code: "PAYMENT_IN_ANALYSIS" }, 409, cors);
  }

  if (isPreChargeState(context.scheduleState)) {
    const preChargeResult = await deps.preChargeCancel({
      serviceId,
      actorId: user.id,
      cancellationReason: body.cancellation_reason,
      initiator,
    });

    if (typeof preChargeResult === "string") {
      return jsonResponse(
        {
          schedule_id: preChargeResult,
          outcome: "PRE_CHARGE_CANCELLED",
        },
        200,
        cors,
      );
    }

    return jsonResponse(
      { error_code: preChargeResult },
      mapErrorStatus(preChargeResult),
      cors,
    );
  }

  if (context.scheduleState !== "PAID" && context.scheduleState !== "REFUND_REQUESTED") {
    return jsonResponse({ error_code: "INVALID_SCHEDULE_STATE" }, 409, cors);
  }

  if (!context.serviceScheduledAt && context.scheduleState === "PAID") {
    return jsonResponse({ error: "service_scheduled_at_missing" }, 422, cors);
  }

  const submitResult = await deps.submitRefundRequest({
    serviceId,
    actorId: user.id,
    cancellationReason: body.cancellation_reason,
    initiator,
  });

  if (typeof submitResult === "string") {
    return jsonResponse(
      { error_code: submitResult },
      mapErrorStatus(submitResult),
      cors,
    );
  }

  if (!submitResult.alreadySubmitted) {
    const refundResult = await deps.refundTransaction({
      transactionId: submitResult.providerTransactionId,
      amount: submitResult.refundAmount,
      referenceCode: serviceId,
    });

    if (refundResult.success || refundResult.error?.code === "ALREADY_REFUNDED") {
      return jsonResponse(
        {
          schedule_id: submitResult.scheduleId,
          refund_amount: submitResult.refundAmount,
          penalty_tier: submitResult.penaltyTier,
          expected_days: EXPECTED_REFUND_DAYS,
        },
        200,
        cors,
      );
    }

    const errorMessage = refundResult.error?.message ?? "refund_failed";
    deps.captureCriticalError(new Error(errorMessage), {
      schedule_id: submitResult.scheduleId,
      service_id: serviceId,
      error_code: refundResult.error?.code ?? "UNKNOWN",
    });

    await deps.recordRefundFailed({
      scheduleId: submitResult.scheduleId,
      serviceId,
      actorId: user.id,
      initiator,
      errorMessage,
    });

    logger.error("refund_gateway_failed", {
      schedule_id: submitResult.scheduleId,
      service_id: serviceId,
      error: errorMessage,
    });

    return jsonResponse(
      {
        error: "refund_failed",
        error_code: refundResult.error?.code ?? "UNKNOWN",
        support_url: deps.getSupportUrl(),
      },
      500,
      cors,
    );
  }

  return jsonResponse(
    {
      schedule_id: submitResult.scheduleId,
      refund_amount: submitResult.refundAmount,
      penalty_tier: submitResult.penaltyTier,
      expected_days: EXPECTED_REFUND_DAYS,
      already_submitted: true,
    },
    200,
    cors,
  );
}
