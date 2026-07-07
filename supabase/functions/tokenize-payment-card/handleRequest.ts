import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import {
  AdapterRegistry,
  type PaymentProvider,
} from "../_shared/payment/index.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";
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
const RATE_LIMIT_CONFIG = { perMinute: 10, failClosed: true };

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
  resolveProviderAccount: (
    providerServiceId: string,
  ) => Promise<ResolvedProviderAccount | null>;
  resolvePlatformCompany: () => Promise<ResolvedProviderAccount | null>;
  tokenizeCard: PaymentProvider["tokenizeCard"];
  insertPaymentToken: (input: {
    clientId: string;
    parsed: ParsedTokenizeRequest;
    tokenizeResult: Awaited<ReturnType<PaymentProvider["tokenizeCard"]>>;
  }) => Promise<PaymentTokenInsertResult | null>;
  recordCardTokenizedEvent: (input: {
    paymentTokenId: string;
    clientId: string;
  }) => Promise<void>;
  checkRateLimit: typeof checkRateLimit;
};

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

  const clientIP = getClientIP(req);
  const rateLimit = await deps.checkRateLimit(
    clientIP,
    user.id,
    "tokenize-payment-card",
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

  const providerAccount = validated.tokenizeContext === "profile"
    ? await deps.resolvePlatformCompany()
    : await deps.resolveProviderAccount(validated.providerServiceId ?? "");
  if (!providerAccount) {
    return jsonResponse({ error: "provider_not_credentialed" }, 409, cors);
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
      companyId: providerAccount.netcredCompanyId,
      persist: false,
    },
    cpf: validated.cpf,
    phone: validated.phone,
    email,
  });

  if (!tokenizeResult.isActive) {
    logger.warn("tokenization_failed", {
      client_id: user.id,
      tokenize_context: validated.tokenizeContext,
      provider_service_id: validated.providerServiceId ?? null,
      error_count: tokenizeResult.errors?.length ?? 0,
      error_code: tokenizeResult.errors?.[0]?.code ?? null,
    });
    return jsonResponse(
      { errors: tokenizeResult.errors ?? [{ message: "Tokenization failed" }] },
      422,
      cors,
    );
  }

  const inserted = await deps.insertPaymentToken({
    clientId: user.id,
    parsed: validated,
    tokenizeResult,
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
