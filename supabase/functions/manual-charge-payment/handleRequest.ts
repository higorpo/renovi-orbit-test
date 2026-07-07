import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import { extractClientIp } from "./extractClientIp.ts";
import { buildPayoutRule } from "../_shared/payment/buildPayoutRule.ts";
import { enqueueManualChargeNotifications } from "./enqueueNotifications.ts";
import { resolveChargeOutcome } from "./resolveChargeOutcome.ts";
import type {
  ManualChargeAcquireErrorCode,
  ManualChargePaymentBody,
  ManualChargeSchedule,
  PaymentTokenRecord,
  ProviderAccountRecord,
} from "./types.ts";

const logger = createPaymentLogger("manual-charge-payment");
const RATE_LIMIT_CONFIG = { perMinute: 10, failClosed: true };

export type ManualChargePaymentDeps = {
  getUser: (token: string) => Promise<{ user: { id: string } | null; error: Error | null }>;
  acquireLease: (input: {
    scheduleId: string;
    clientId: string;
    clearsaleSessionId: string;
    clientIpAddress: string | null;
    actorId: string;
  }) => Promise<
    | { schedule: ManualChargeSchedule }
    | { error: ManualChargeAcquireErrorCode }
  >;
  calculateChargeAmount: (input: {
    clientCardTokenId: string;
    baseAmount: number;
    installmentNumber: number;
  }) => Promise<string | null>;
  loadPaymentToken: (tokenId: string) => Promise<PaymentTokenRecord | null>;
  loadProviderAccount: (providerId: string) => Promise<ProviderAccountRecord | null>;
  createCharge: PaymentProvider["createCharge"];
  commitResult: (input: {
    scheduleId: string;
    clientId: string;
    outcome: ReturnType<typeof resolveChargeOutcome>;
    chargeAmount: string;
    providerChargeId?: string;
    providerTransactionId?: string;
    failureCode?: string;
    failureReason?: string;
    gatewayLatencyMs: number;
    providerResponseSummary: Record<string, unknown>;
    actorId: string;
  }) => Promise<string | null>;
  enqueueNotification: (
    scheduleId: string,
    notificationEvent: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  checkRateLimit: typeof checkRateLimit;
  now?: () => number;
};

function mapAcquireErrorStatus(error: ManualChargeAcquireErrorCode): number {
  switch (error) {
    case "SCHEDULE_NOT_FOUND":
      return 404;
    case "CLEARSALE_SESSION_REQUIRED":
      return 400;
    case "RATE_LIMIT_EXCEEDED":
      return 429;
    default:
      return 409;
  }
}

function buildProviderResponseSummary(
  result: CreateChargeResult,
): Record<string, unknown> {
  return {
    success: result.success,
    transactionState: result.transactionState ?? null,
    chargeId: result.chargeId ?? null,
    transactionId: result.transactionId ?? null,
    errorCode: result.error?.code ?? null,
    originalCode: result.error?.originalCode ?? null,
  };
}

export async function handleManualChargePaymentRequest(
  req: Request,
  deps: ManualChargePaymentDeps,
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
    "manual-charge-payment",
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

  let body: ManualChargePaymentBody;
  try {
    body = await req.json() as ManualChargePaymentBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const scheduleId = body.schedule_id?.trim();
  const clearsaleSessionId = body.clearsale_session_id?.trim();

  if (!scheduleId) {
    return jsonResponse({ error: "schedule_id is required" }, 400, cors);
  }

  if (!clearsaleSessionId) {
    return jsonResponse({ error_code: "CLEARSALE_SESSION_REQUIRED" }, 400, cors);
  }

  const clientIpAddress = extractClientIp(req);
  const acquireResult = await deps.acquireLease({
    scheduleId,
    clientId: user.id,
    clearsaleSessionId,
    clientIpAddress,
    actorId: user.id,
  });

  if ("error" in acquireResult) {
    return jsonResponse(
      { error_code: acquireResult.error },
      mapAcquireErrorStatus(acquireResult.error),
      cors,
    );
  }

  const schedule = acquireResult.schedule;

  logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_STARTED, {
    service_id: schedule.contracted_service_id,
    schedule_id: schedule.id,
    gateway_slug: schedule.gateway_slug,
    attempt_number: schedule.manual_attempt_count + 1,
    initiator: "manual",
  });

  if (!schedule.client_card_token_id) {
    return jsonResponse({ error_code: "PAYMENT_TOKEN_MISSING" }, 422, cors);
  }

  const paymentToken = await deps.loadPaymentToken(schedule.client_card_token_id);
  if (!paymentToken || paymentToken.state !== "ACTIVE") {
    return jsonResponse({ error_code: "PAYMENT_TOKEN_INACTIVE" }, 422, cors);
  }

  const providerAccount = await deps.loadProviderAccount(schedule.provider_id);
  if (
    !providerAccount?.netcred_company_id ||
    !providerAccount.netcred_bank_account_id ||
    providerAccount.onboarding_status !== "ACTIVE"
  ) {
    return jsonResponse({ error_code: "PROVIDER_NOT_CREDENTIALED" }, 422, cors);
  }

  const chargeAmount = await deps.calculateChargeAmount({
    clientCardTokenId: schedule.client_card_token_id,
    baseAmount: schedule.base_amount,
    installmentNumber: schedule.installment_number,
  });

  if (!chargeAmount) {
    logger.error(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_FAILED, {
      service_id: schedule.contracted_service_id,
      schedule_id: schedule.id,
      gateway_slug: schedule.gateway_slug,
      error_code: "CHARGE_AMOUNT_CALCULATION_FAILED",
      error: "charge_amount_calculation_failed",
    });
    return jsonResponse({ error: "charge_amount_calculation_failed" }, 500, cors);
  }

  let payoutRule;
  try {
    payoutRule = buildPayoutRule(
      {
        netcredCompanyId: providerAccount.netcred_company_id,
        netcredBankAccountId: providerAccount.netcred_bank_account_id,
      },
      Number(schedule.provider_payout).toFixed(2),
      chargeAmount,
    );
  } catch {
    return jsonResponse({ error_code: "PROVIDER_NOT_CREDENTIALED" }, 422, cors);
  }

  const chargeInput: CreateChargeInput = {
    referenceCode: schedule.contracted_service_id,
    serviceTitle: schedule.service_request_title ?? undefined,
    amount: chargeAmount,
    paymentMethod: {
      type: "CREDIT_CARD",
      installmentNumber: schedule.installment_number,
      paymentProfileId: paymentToken.gateway_payment_profile_id,
      paymentToken: paymentToken.gateway_card_token,
    },
    payoutRule,
    sessionId: schedule.clearsale_session_id ?? undefined,
    customerIpAddress: schedule.client_ip_address ?? clientIpAddress ?? undefined,
  };

  const startedAt = deps.now?.() ?? Date.now();
  const chargeResult = await deps.createCharge(chargeInput);
  const gatewayLatencyMs = Math.max(0, (deps.now?.() ?? Date.now()) - startedAt);
  const outcome = resolveChargeOutcome(chargeResult);

  const committedScheduleId = await deps.commitResult({
    scheduleId: schedule.id,
    clientId: user.id,
    outcome,
    chargeAmount,
    providerChargeId: chargeResult.chargeId,
    providerTransactionId: chargeResult.transactionId,
    failureCode: chargeResult.error?.originalCode ?? chargeResult.error?.code,
    failureReason: chargeResult.error?.message,
    gatewayLatencyMs,
    providerResponseSummary: buildProviderResponseSummary(chargeResult),
    actorId: user.id,
  });

  if (!committedScheduleId) {
    logger.error(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_FAILED, {
      service_id: schedule.contracted_service_id,
      schedule_id: schedule.id,
      gateway_slug: schedule.gateway_slug,
      error_code: "COMMIT_FAILED",
      outcome,
    });
    return jsonResponse({ error: "manual_charge_commit_failed" }, 500, cors);
  }

  logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, {
    service_id: schedule.contracted_service_id,
    schedule_id: schedule.id,
    gateway_slug: schedule.gateway_slug,
    outcome,
    gateway_latency_ms: gatewayLatencyMs,
    charge_amount: chargeAmount,
    attempt_number: schedule.manual_attempt_count + 1,
    initiator: "manual",
    error_code: chargeResult.error?.code,
  });

  try {
    await enqueueManualChargeNotifications(
      deps.enqueueNotification,
      schedule,
      outcome,
      chargeAmount,
    );
  } catch (notificationError) {
    logger.warn("manual_charge_notification_enqueue_failed", {
      service_id: schedule.contracted_service_id,
      schedule_id: schedule.id,
      gateway_slug: schedule.gateway_slug,
      error: notificationError instanceof Error
        ? notificationError.message
        : String(notificationError),
    });
  }

  return jsonResponse(
    {
      schedule_id: committedScheduleId,
      outcome,
      charge_amount: chargeAmount,
    },
    200,
    cors,
  );
}
