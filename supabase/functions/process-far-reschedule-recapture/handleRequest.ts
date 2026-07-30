import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { validateOrbitCronAuth } from "../_shared/security/orbit-cron-auth.ts";
import type { PaymentProvider } from "../_shared/payment/types.ts";
import type {
  FarRecaptureBody,
  FarRecaptureCommitResult,
  FarRecaptureErrorCode,
  FarRecapturePrepareResult,
} from "./types.ts";
import { FAR_RECAPTURE_ERROR_CODES, mapFarRecaptureRpcError } from "./types.ts";

const logger = createPaymentLogger("process-far-reschedule-recapture");

export type ProcessFarRecaptureDeps = {
  prepare: (input: {
    scheduleId?: string;
    contractedServiceId?: string;
  }) => Promise<FarRecapturePrepareResult | FarRecaptureErrorCode>;
  commitAfterGateway: (input: {
    scheduleId: string;
    expectedRefundAmount?: string;
  }) => Promise<FarRecaptureCommitResult | FarRecaptureErrorCode>;
  markGatewayAcked: (input: {
    scheduleId: string;
    refundedAmount?: string;
  }) => Promise<void>;
  refundTransaction: PaymentProvider["refundTransaction"];
  captureCriticalError: (error: unknown, extra: Record<string, unknown>) => void;
};

function isErrorCode(value: string): value is FarRecaptureErrorCode {
  return (FAR_RECAPTURE_ERROR_CODES as readonly string[]).includes(value);
}

function mapErrorStatus(error: FarRecaptureErrorCode): number {
  switch (error) {
    case "SCHEDULE_NOT_FOUND":
    case "SERVICE_NOT_FOUND":
      return 404;
    default:
      return 409;
  }
}

async function commitWithRecovery(
  deps: ProcessFarRecaptureDeps,
  input: {
    scheduleId: string;
    prepareResult: FarRecapturePrepareResult;
  },
): Promise<FarRecaptureCommitResult | FarRecaptureErrorCode> {
  const commitInput = {
    scheduleId: input.scheduleId,
    expectedRefundAmount: input.prepareResult.refundAmount,
  };

  const first = await deps.commitAfterGateway(commitInput);
  if (typeof first !== "string") {
    return first;
  }

  deps.captureCriticalError(new Error(first), {
    schedule_id: input.scheduleId,
    service_id: input.prepareResult.contractedServiceId,
    error_code: first,
    phase: "commit_far_recapture_after_gateway",
  });

  try {
    await deps.markGatewayAcked({
      scheduleId: input.scheduleId,
      refundedAmount: input.prepareResult.refundAmount,
    });
  } catch (markError) {
    deps.captureCriticalError(markError, {
      schedule_id: input.scheduleId,
      service_id: input.prepareResult.contractedServiceId,
      phase: "mark_far_recapture_gateway_acked",
    });
  }

  return await deps.commitAfterGateway(commitInput);
}

export async function handleProcessFarRescheduleRecaptureRequest(
  req: Request,
  deps: ProcessFarRecaptureDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const auth = validateOrbitCronAuth(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.code }, auth.status, cors);
  }

  let body: FarRecaptureBody;
  try {
    body = await req.json() as FarRecaptureBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const scheduleId = body.schedule_id?.trim() || undefined;
  const contractedServiceId = body.contracted_service_id?.trim() || undefined;

  if (!scheduleId && !contractedServiceId) {
    return jsonResponse(
      { error: "schedule_id or contracted_service_id is required" },
      400,
      cors,
    );
  }

  const prepareResult = await deps.prepare({ scheduleId, contractedServiceId });

  if (typeof prepareResult === "string") {
    return jsonResponse(
      { error_code: prepareResult },
      mapErrorStatus(prepareResult),
      cors,
    );
  }

  if (prepareResult.outcome === "already_done") {
    return jsonResponse(
      {
        outcome: "already_done",
        schedule_id: prepareResult.scheduleId,
        new_schedule_id: prepareResult.newScheduleId,
        contracted_service_id: prepareResult.contractedServiceId,
      },
      200,
      cors,
    );
  }

  if (prepareResult.alreadySubmitted) {
    const commitResult = await deps.commitAfterGateway({
      scheduleId: prepareResult.scheduleId,
      expectedRefundAmount: prepareResult.refundAmount,
    });

    if (typeof commitResult === "string") {
      return jsonResponse(
        { error_code: commitResult },
        mapErrorStatus(commitResult),
        cors,
      );
    }

    return jsonResponse(
      {
        outcome: commitResult.outcome,
        schedule_id: commitResult.scheduleId,
        new_schedule_id: commitResult.newScheduleId,
        contracted_service_id: commitResult.contractedServiceId,
        refund_amount: commitResult.refundAmount,
        already_submitted: true,
      },
      200,
      cors,
    );
  }

  const refundResult = await deps.refundTransaction({
    transactionId: prepareResult.providerTransactionId,
    amount: prepareResult.refundAmount,
    referenceCode: prepareResult.gatewayReferenceCode
      ?? prepareResult.contractedServiceId,
  });

  if (refundResult.success || refundResult.error?.code === "ALREADY_REFUNDED") {
    const commitResult = await commitWithRecovery(deps, {
      scheduleId: prepareResult.scheduleId,
      prepareResult,
    });

    if (typeof commitResult === "string") {
      deps.captureCriticalError(new Error(commitResult), {
        schedule_id: prepareResult.scheduleId,
        service_id: prepareResult.contractedServiceId,
        error_code: commitResult,
        phase: "commit_far_recapture_exhausted",
      });

      return jsonResponse(
        {
          error: "far_recapture_commit_failed",
          error_code: commitResult,
          refund_submit_status: "SUBMITTED",
        },
        500,
        cors,
      );
    }

    return jsonResponse(
      {
        outcome: commitResult.outcome,
        schedule_id: commitResult.scheduleId,
        new_schedule_id: commitResult.newScheduleId,
        contracted_service_id: commitResult.contractedServiceId,
        refund_amount: commitResult.refundAmount,
      },
      200,
      cors,
    );
  }

  const errorMessage = refundResult.error?.message ?? "refund_failed";
  deps.captureCriticalError(new Error(errorMessage), {
    schedule_id: prepareResult.scheduleId,
    service_id: prepareResult.contractedServiceId,
    error_code: refundResult.error?.code ?? "UNKNOWN",
    phase: "gateway_far_recapture_refund",
  });

  logger.error("far_recapture_gateway_failed", {
    schedule_id: prepareResult.scheduleId,
    service_id: prepareResult.contractedServiceId,
    error: errorMessage,
  });

  return jsonResponse(
    {
      error: "refund_failed",
      error_code: refundResult.error?.code ?? "UNKNOWN",
      schedule_id: prepareResult.scheduleId,
      pending: true,
    },
    500,
    cors,
  );
}

export { isErrorCode, mapFarRecaptureRpcError };
