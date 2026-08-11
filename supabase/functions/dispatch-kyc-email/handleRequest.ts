import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";
import {
  buildCredenciamentoEmailHtml,
  buildCredenciamentoEmailSubject,
} from "./buildCredenciamentoEmailHtml.ts";
import {
  buildKycAttachmentSpecs,
  downloadKycAttachments,
  PROVIDER_KYC_DEEP_LINK_PATH,
  type DownloadStorageObject,
} from "./kycAttachments.ts";
import {
  sendCredenciamentoEmail,
  type SendCredenciamentoEmailResult,
} from "./sendCredenciamentoEmail.ts";
import type {
  DispatchKycEmailSuccess,
  ProviderGatewayAccountRow,
  ProviderKycContext,
} from "./types.ts";
import {
  entityTypeFromDb,
  validateDispatchKycEmailBody,
} from "./validateRequest.ts";

const logger = createPaymentLogger("dispatch-kyc-email");
const RATE_LIMIT_CONFIG = { perMinute: 5, failClosed: true };

export type DispatchKycEmailDeps = {
  getUser: (
    token: string,
  ) => Promise<{ user: { id: string; email?: string } | null; error: Error | null }>;
  loadGatewayAccount: (
    providerId: string,
  ) => Promise<ProviderGatewayAccountRow | null>;
  loadProviderKycContext: (input: {
    providerId: string;
    gatewayAccount: ProviderGatewayAccountRow;
    authEmail: string;
  }) => Promise<ProviderKycContext | null>;
  downloadStorageObject: DownloadStorageObject;
  sendCredenciamentoEmail: (
    input: Parameters<typeof sendCredenciamentoEmail>[0],
  ) => Promise<SendCredenciamentoEmailResult>;
  markEmailDispatched: (providerGatewayAccountId: string) => Promise<void>;
  ingestProviderKycSubmitted: (input: {
    providerId: string;
    providerGatewayAccountId: string;
  }) => Promise<void>;
  resolveCredenciamentoRecipientEmail: () => string;
  checkRateLimit: typeof checkRateLimit;
};

function successResponse(
  payload: DispatchKycEmailSuccess,
  cors: Record<string, string>,
): Response {
  return jsonResponse(payload, 200, cors);
}

export async function handleDispatchKycEmailRequest(
  req: Request,
  deps: DispatchKycEmailDeps,
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
    "dispatch-kyc-email",
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse(
      { error_code: "INVALID_JSON", error: "Invalid JSON body" },
      400,
      cors,
    );
  }

  const validated = validateDispatchKycEmailBody(rawBody);
  if (!validated.ok) {
    return jsonResponse(
      {
        error_code: validated.errorCode,
        error: validated.error,
        field: validated.field,
      },
      validated.status,
      cors,
    );
  }

  const retryOnly = validated.body.retry_only === true;
  const authEmail = user.email?.trim().toLowerCase();
  if (!authEmail) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const gatewayAccount = await deps.loadGatewayAccount(user.id);
  if (!gatewayAccount) {
    return jsonResponse(
      { error_code: "INVALID_ONBOARDING_STATE", error: "Conta de pagamento não encontrada" },
      409,
      cors,
    );
  }

  if (gatewayAccount.onboarding_status !== "DOCUMENTS_SUBMITTED") {
    return jsonResponse(
      {
        error_code: "INVALID_ONBOARDING_STATE",
        error: "Credenciamento não está aguardando envio de e-mail",
      },
      409,
      cors,
    );
  }

  if (!retryOnly) {
    if (gatewayAccount.document !== validated.body.document) {
      return jsonResponse(
        {
          error_code: "DOCUMENT_MISMATCH",
          error: "Documento não confere com o cadastro",
          field: "document",
        },
        409,
        cors,
      );
    }

    if (authEmail !== validated.body.email) {
      return jsonResponse(
        {
          error_code: "FORBIDDEN",
          error: "E-mail deve ser o da conta Prestway",
          field: "email",
        },
        403,
        cors,
      );
    }
  }

  if (gatewayAccount.email_dispatched_at) {
    await deps.ingestProviderKycSubmitted({
      providerId: user.id,
      providerGatewayAccountId: gatewayAccount.id,
    }).catch((err) => {
      logger.warn("provider_kyc_submitted_notification_retry_failed", {
        provider_id: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return successResponse(
      {
        submission_id: gatewayAccount.id,
        email_dispatched: true,
        email_pending: false,
      },
      cors,
    );
  }

  const context = await deps.loadProviderKycContext({
    providerId: user.id,
    gatewayAccount,
    authEmail,
  });

  if (!context) {
    return jsonResponse(
      {
        error_code: "PROVIDER_PROFILE_NOT_FOUND",
        error: "Perfil de prestador incompleto",
      },
      404,
      cors,
    );
  }

  if (!retryOnly) {
    const expectedEntityType = entityTypeFromDb(context.privateProfile.entityType);
    if (expectedEntityType !== validated.body.entity_type) {
      return jsonResponse(
        {
          error_code: "DOCUMENT_MISMATCH",
          error: "Tipo de cadastro não confere",
          field: "entity_type",
        },
        409,
        cors,
      );
    }
  }

  const attachmentSpecs = buildKycAttachmentSpecs({
    entityType: context.privateProfile.entityType,
    identityDocStoragePath: context.privateProfile.identityDocStoragePath,
    addressProofStoragePath: context.privateProfile.addressProofStoragePath,
    corporateCharterStoragePath: context.privateProfile.corporateCharterStoragePath,
    legalRepDocStoragePath: context.privateProfile.legalRepDocStoragePath,
  });

  const downloaded = await downloadKycAttachments(
    attachmentSpecs,
    deps.downloadStorageObject,
  );

  if (!downloaded.ok) {
    logger.error("kyc_storage_download_failed", {
      provider_id: user.id,
      error: downloaded.errorMessage,
    });
    return jsonResponse(
      {
        error_code: downloaded.errorCode,
        error: "Falha ao preparar anexos do credenciamento",
      },
      502,
      cors,
    );
  }

  const correlationId = `kyc-credenciamento:${gatewayAccount.id}`;
  const sendResult = await deps.sendCredenciamentoEmail({
    recipientEmail: deps.resolveCredenciamentoRecipientEmail(),
    subject: buildCredenciamentoEmailSubject(context),
    html: buildCredenciamentoEmailHtml(context),
    attachments: downloaded.attachments,
    correlationId,
  });

  if (!sendResult.ok) {
    logger.error("credenciamento_email_failed", {
      provider_id: user.id,
      error_code: sendResult.errorCode,
      error_message: sendResult.errorMessage,
    });
    return jsonResponse(
      {
        error_code: "CREDENCIAMENTO_EMAIL_FAILED",
        error: "Falha ao enviar credenciamento para a NetCred",
        email_pending: true,
      },
      502,
      cors,
    );
  }

  try {
    await deps.markEmailDispatched(gatewayAccount.id);
  } catch (err) {
    logger.error("mark_kyc_email_dispatched_failed", {
      provider_id: user.id,
      provider_gateway_account_id: gatewayAccount.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse(
      {
        error_code: "MARK_DISPATCHED_FAILED",
        error: "E-mail enviado, mas falha ao confirmar envio",
        email_pending: true,
      },
      500,
      cors,
    );
  }

  try {
    await deps.ingestProviderKycSubmitted({
      providerId: user.id,
      providerGatewayAccountId: gatewayAccount.id,
    });
  } catch (err) {
    logger.error("provider_kyc_submitted_notification_failed", {
      provider_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("credenciamento_email_dispatched", {
    provider_id: user.id,
    provider_gateway_account_id: gatewayAccount.id,
    vendor_message_id: sendResult.vendorMessageId,
  });

  return successResponse(
    {
      submission_id: gatewayAccount.id,
      email_dispatched: true,
      email_pending: false,
    },
    cors,
  );
}

export { PROVIDER_KYC_DEEP_LINK_PATH };
