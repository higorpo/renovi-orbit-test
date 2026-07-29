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
import { isPreChargeState, isRefundGatewayAcked, resolveInitiator } from "./types.ts";

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
  prepareRefundRequest: (input: {
    serviceId: string;
    actorId: string;
    cancellationReason?: string;
    initiator: "client" | "provider";
  }) => Promise<RefundSubmitResult | ProcessRefundErrorCode>;
  commitRefundAfterGateway: (input: {
    serviceId: string;
    actorId: string;
    cancellationReason?: string;
    initiator: "client" | "provider";
    expectedRefundAmount?: string;
  }) => Promise<RefundSubmitResult | ProcessRefundErrorCode>;
  markRefundGatewayAcked: (input: {
    scheduleId: string;
    actorId: string;
    refundedAmount?: string;
  }) => Promise<void>;
  refundTransaction: PaymentProvider["refundTransaction"];
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

const PROCESS_REFUND_ERROR_CODES: readonly ProcessRefundErrorCode[] = [
  "SERVICE_NOT_FOUND",
  "SCHEDULE_NOT_FOUND",
  "FORBIDDEN",
  "SERVICE_NOT_CANCELLABLE",
  "PAYMENT_IN_ANALYSIS",
  "INVALID_SCHEDULE_STATE",
  "TRANSACTION_NOT_FOUND",
  "PAYMENT_SCHEDULE_TERMINAL_STATE",
  "PAYMENT_SCHEDULE_INVALID_TRANSITION",
  "INVALID_REFUND_AMOUNT",
];

function mapRpcError(message: string): ProcessRefundErrorCode | null {
  return PROCESS_REFUND_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}

export function mapRpcErrorCode(message: string): ProcessRefundErrorCode | null {
  return mapRpcError(message);
}

function isProcessRefundErrorCode(
  value: string,
): value is ProcessRefundErrorCode {
  return (PROCESS_REFUND_ERROR_CODES as readonly string[]).includes(value);
}

function successRefundBody(result: RefundSubmitResult, alreadySubmitted = false) {
  return {
    schedule_id: result.scheduleId,
    refund_amount: result.refundAmount,
    penalty_tier: result.penaltyTier,
    expected_days: EXPECTED_REFUND_DAYS,
    refund_submit_status: result.refundSubmitStatus ?? "SUBMITTED",
    ...(alreadySubmitted ? { already_submitted: true } : {}),
  };
}

async function commitWithRecovery(
  deps: ProcessRefundDeps,
  input: {
    serviceId: string;
    actorId: string;
    cancellationReason?: string;
    initiator: "client" | "provider";
    prepareResult: RefundSubmitResult;
  },
): Promise<RefundSubmitResult | ProcessRefundErrorCode> {
  const commitInput = {
    serviceId: input.serviceId,
    actorId: input.actorId,
    cancellationReason: input.cancellationReason,
    initiator: input.initiator,
    expectedRefundAmount: input.prepareResult.refundAmount,
  };

  const first = await deps.commitRefundAfterGateway(commitInput);
  if (typeof first !== "string") {
    return first;
  }

  deps.captureCriticalError(new Error(first), {
    schedule_id: input.prepareResult.scheduleId,
    service_id: input.serviceId,
    error_code: first,
    phase: "commit_refund_after_gateway",
  });

  try {
    await deps.markRefundGatewayAcked({
      scheduleId: input.prepareResult.scheduleId,
      actorId: input.actorId,
      refundedAmount: input.prepareResult.refundAmount,
    });
  } catch (markError) {
    deps.captureCriticalError(markError, {
      schedule_id: input.prepareResult.scheduleId,
      service_id: input.serviceId,
      phase: "mark_refund_gateway_acked",
    });
  }

  const retry = await deps.commitRefundAfterGateway(commitInput);
  return retry;
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

    if (isProcessRefundErrorCode(preChargeResult)) {
      return jsonResponse(
        { error_code: preChargeResult },
        mapErrorStatus(preChargeResult),
        cors,
      );
    }

    return jsonResponse(
      {
        schedule_id: preChargeResult,
        outcome: "PRE_CHARGE_CANCELLED",
      },
      200,
      cors,
    );
  }

  // ---------------------------------------------------------------------------
  // Greenfield REFUND_REQUESTED: ACK short-circuit only (no cancel-first retry)
  // ---------------------------------------------------------------------------
  if (context.scheduleState === "REFUND_REQUESTED") {
    if (isRefundGatewayAcked(context.refundSubmitStatus)) {
      return jsonResponse(
        {
          schedule_id: context.scheduleId,
          refund_amount: context.paidAmount != null
            ? String(context.paidAmount)
            : String(context.baseAmount),
          penalty_tier: null,
          expected_days: EXPECTED_REFUND_DAYS,
          refund_submit_status: context.refundSubmitStatus,
          already_submitted: true,
        },
        200,
        cors,
      );
    }

    return jsonResponse({ error_code: "INVALID_SCHEDULE_STATE" }, 409, cors);
  }

  if (context.scheduleState !== "PAID") {
    return jsonResponse({ error_code: "INVALID_SCHEDULE_STATE" }, 409, cors);
  }

  if (!context.serviceScheduledAt) {
    return jsonResponse({ error: "service_scheduled_at_missing" }, 422, cors);
  }

  // ---------------------------------------------------------------------------
  // Option A — PAID: prepare → gateway → commit (zero DB writes on gateway fail)
  // ---------------------------------------------------------------------------
  const prepareResult = await deps.prepareRefundRequest({
    serviceId,
    actorId: user.id,
    cancellationReason: body.cancellation_reason,
    initiator,
  });

  if (typeof prepareResult === "string") {
    return jsonResponse(
      { error_code: prepareResult },
      mapErrorStatus(prepareResult),
      cors,
    );
  }

  const refundResult = await deps.refundTransaction({
    transactionId: prepareResult.providerTransactionId,
    amount: prepareResult.refundAmount,
    referenceCode: serviceId,
  });

  if (refundResult.success || refundResult.error?.code === "ALREADY_REFUNDED") {
    const commitResult = await commitWithRecovery(deps, {
      serviceId,
      actorId: user.id,
      cancellationReason: body.cancellation_reason,
      initiator,
      prepareResult,
    });

    if (typeof commitResult === "string") {
      deps.captureCriticalError(new Error(commitResult), {
        schedule_id: prepareResult.scheduleId,
        service_id: serviceId,
        error_code: commitResult,
        phase: "commit_refund_exhausted",
      });

      return jsonResponse(
        {
          error: "refund_commit_failed",
          error_code: commitResult,
          refund_submit_status: "SUBMITTED",
          support_url: deps.getSupportUrl(),
        },
        500,
        cors,
      );
    }

    return jsonResponse(successRefundBody(commitResult), 200, cors);
  }

  // Gateway fail on PAID: zero DB writes.
  const errorMessage = refundResult.error?.message ?? "refund_failed";
  deps.captureCriticalError(new Error(errorMessage), {
    schedule_id: prepareResult.scheduleId,
    service_id: serviceId,
    error_code: refundResult.error?.code ?? "UNKNOWN",
    phase: "gateway_refund_paid",
  });

  logger.error("refund_gateway_failed", {
    schedule_id: prepareResult.scheduleId,
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
