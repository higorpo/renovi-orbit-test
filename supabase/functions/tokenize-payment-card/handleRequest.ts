import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import {
  AdapterRegistry,
  toOpaqueTokenizeClientError,
  type PaymentProvider,
} from "../_shared/payment/index.ts";
import {
  checkRateLimit,
  DAILY_RATE_LIMIT_WINDOW_MS,
  getClientIP,
  type RateLimitConfig,
} from "../_shared/rateLimiter.ts";
import type {
  ResolvedProviderAccount,
  TokenizePaymentCardBody,
  TokenizePaymentCardSuccess,
} from "./types.ts";
import {
  validateTokenizePaymentCardBody,
  type ParsedTokenizeRequest,
} from "./validateRequest.ts";

const logger = createPaymentLogger("tokenize-payment-card");

/** Profile tokenize: tight carding controls (CHK-014). */
const PROFILE_PER_MINUTE_LIMIT = 3;
const PROFILE_DAILY_LIMIT = 30;
/** Checkout tokenize: moderate per-minute cap. */
const CHECKOUT_PER_MINUTE_LIMIT = 10;

const FAIL_CLOSED: Pick<RateLimitConfig, "failClosed"> = { failClosed: true };

export type PaymentTokenInsertResult = {
  id: string;
  card_number_masked: string;
  card_brand: string;
};

export type TokenizePaymentCardDeps = {
  getUser: (token: string) => Promise<{
    user: { id: string; email?: string | null } | null;
    error: Error | null;
  }>;
  validateCheckoutAccess: (
    clientId: string,
    proposalId: string,
  ) => Promise<void>;
  resolvePlatformCompany: () => Promise<ResolvedProviderAccount | null>;
  tokenizeCard: PaymentProvider["tokenizeCard"];
  insertPaymentToken: (input: {
    clientId: string;
    parsed: ParsedTokenizeRequest;
    tokenizeResult: Awaited<ReturnType<PaymentProvider["tokenizeCard"]>>;
    netcredCompanyId: string;
  }) => Promise<PaymentTokenInsertResult | null>;
  recordCardTokenizedEvent: (input: {
    paymentTokenId: string;
    clientId: string;
  }) => Promise<void>;
  checkRateLimit: typeof checkRateLimit;
};

function rateLimitedResponse(
  cors: Record<string, string>,
  retryAfter: number,
): Response {
  return jsonResponse(
    {
      error: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAfter,
    },
    429,
    { ...cors, "Retry-After": String(retryAfter) },
  );
}

async function enforceTokenizeRateLimits(
  deps: TokenizePaymentCardDeps,
  clientIP: string,
  userId: string,
  tokenizeContext: "profile" | "checkout",
  cors: Record<string, string>,
): Promise<Response | null> {
  if (tokenizeContext === "profile") {
    const perMinute = await deps.checkRateLimit(
      clientIP,
      userId,
      "tokenize-payment-card:profile",
      { perMinute: PROFILE_PER_MINUTE_LIMIT, ...FAIL_CLOSED },
    );
    if (!perMinute.allowed) {
      return rateLimitedResponse(cors, perMinute.retryAfter);
    }

    const daily = await deps.checkRateLimit(
      clientIP,
      userId,
      "tokenize-payment-card:profile:daily",
      {
        perMinute: PROFILE_DAILY_LIMIT,
        windowMs: DAILY_RATE_LIMIT_WINDOW_MS,
        ...FAIL_CLOSED,
      },
    );
    if (!daily.allowed) {
      return rateLimitedResponse(cors, daily.retryAfter);
    }

    return null;
  }

  const checkout = await deps.checkRateLimit(
    clientIP,
    userId,
    "tokenize-payment-card:checkout",
    { perMinute: CHECKOUT_PER_MINUTE_LIMIT, ...FAIL_CLOSED },
  );
  if (!checkout.allowed) {
    return rateLimitedResponse(cors, checkout.retryAfter);
  }

  return null;
}

export async function handleTokenizePaymentCardRequest(
  req: Request,
  deps: TokenizePaymentCardDeps,
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

  let body: TokenizePaymentCardBody;
  try {
    body = await req.json() as TokenizePaymentCardBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const validated = validateTokenizePaymentCardBody(body);
  if ("error" in validated) {
    return jsonResponse(
      validated.errors
        ? { errors: validated.errors }
        : { error: validated.error },
      validated.status,
      cors,
    );
  }

  const clientIP = getClientIP(req);
  const rateLimitResponse = await enforceTokenizeRateLimits(
    deps,
    clientIP,
    user.id,
    validated.tokenizeContext,
    cors,
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (validated.tokenizeContext === "checkout") {
    try {
      await deps.validateCheckoutAccess(
        user.id,
        validated.providerServiceId ?? "",
      );
    } catch {
      return jsonResponse({ error: "forbidden" }, 403, cors);
    }
  }

  // Marketplace model: always tokenize under Renovi platform company (not provider).
  const platformCompany = await deps.resolvePlatformCompany();
  if (!platformCompany?.netcredCompanyId?.trim()) {
    return jsonResponse({ error: "platform_company_not_configured" }, 503, cors);
  }

  const email = user.email?.trim();
  if (!email) {
    return jsonResponse(
      {
        error: "email_required",
        errors: [{ message: "EMAIL_REQUIRED", code: "EMAIL_REQUIRED" }],
      },
      422,
      cors,
    );
  }

  const tokenizeResult = await deps.tokenizeCard({
    cardData: validated.cardData,
    billingAddress: validated.billingAddress,
    customerInput: {
      companyId: platformCompany.netcredCompanyId.trim(),
      persist: false,
    },
    cpf: validated.cpf,
    phone: validated.phone,
    email,
  });

  if (!tokenizeResult.isActive) {
    const fineCode = tokenizeResult.errors?.[0]?.code ?? null;
    logger.warn("tokenization_failed", {
      client_id: user.id,
      tokenize_context: validated.tokenizeContext,
      provider_service_id: validated.providerServiceId ?? null,
      error_count: tokenizeResult.errors?.length ?? 0,
      error_code: fineCode,
    });
    return jsonResponse(
      { errors: [toOpaqueTokenizeClientError()] },
      422,
      cors,
    );
  }

  const inserted = await deps.insertPaymentToken({
    clientId: user.id,
    parsed: validated,
    tokenizeResult,
    netcredCompanyId: platformCompany.netcredCompanyId.trim(),
  });

  if (!inserted) {
    return jsonResponse({ error: "failed_to_persist_payment_token" }, 500, cors);
  }

  await deps.recordCardTokenizedEvent({
    paymentTokenId: inserted.id,
    clientId: user.id,
  });

  const response: TokenizePaymentCardSuccess = {
    payment_token_id: inserted.id,
    card_number_masked: inserted.card_number_masked,
    card_brand: inserted.card_brand,
  };

  return jsonResponse(response, 200, cors);
}

export { AdapterRegistry };
