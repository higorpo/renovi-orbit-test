import {
  fetchWithTimeout,
  PROVIDER_HTTP_TIMEOUT_MS,
} from "../_shared/providerHttp.ts";
import {
  buildOutboundFromAddress,
  EmailFromConfigError,
} from "../_shared/emailFrom.ts";

/** Resend HTTP client for worker email sends (design §5.5, task 58, Req.5 AC3). */

export const RESEND_API_URL = "https://api.resend.com/emails";
export const RESEND_HTTP_TIMEOUT_MS = PROVIDER_HTTP_TIMEOUT_MS;

export class ResendConfigError extends Error {
  readonly code = "resend_config_missing";

  constructor(message: string) {
    super(message);
    this.name = "ResendConfigError";
  }
}

export interface SendResendEmailInput {
  /** From checkout RPC only — never from client/template variables. */
  recipientEmail: string;
  subject: string;
  html: string;
  correlationId: string;
}

export type ResendSendSuccess = {
  ok: true;
  vendorMessageId: string;
  httpStatus: number;
};

export type ResendSendFailure = {
  ok: false;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
};

export type ResendSendResult = ResendSendSuccess | ResendSendFailure;

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export function buildResendFromAddress(): string {
  try {
    return buildOutboundFromAddress();
  } catch (err) {
    if (err instanceof EmailFromConfigError) {
      throw new ResendConfigError(err.message);
    }
    throw err;
  }
}

export function buildResendEmailPayload(
  input: SendResendEmailInput,
): ResendEmailPayload {
  const to = input.recipientEmail.trim();
  if (!to) {
    throw new Error("recipient_email is required");
  }

  return {
    from: buildResendFromAddress(),
    to: [to],
    subject: input.subject,
    html: input.html,
  };
}

export function buildResendRequestInit(
  input: SendResendEmailInput,
  apiKey: string,
): RequestInit {
  const payload = buildResendEmailPayload(input);
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.correlationId,
    },
    body: JSON.stringify(payload),
  };
}

export async function sendResendEmail(
  input: SendResendEmailInput,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<ResendSendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey?.trim()) {
    throw new ResendConfigError("RESEND_API_KEY is required");
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? RESEND_HTTP_TIMEOUT_MS;

  try {
    const response = await fetchWithTimeout(
      RESEND_API_URL,
      buildResendRequestInit(input, apiKey),
      { timeoutMs, fetchFn },
    );

    const httpStatus = response.status;
    const bodyText = await response.text();
    let body: { id?: string; message?: string; name?: string } = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      body = { message: bodyText };
    }

    if (response.ok && body.id) {
      return { ok: true, vendorMessageId: body.id, httpStatus };
    }

    return {
      ok: false,
      httpStatus,
      errorCode: body.name ?? "resend_send_failed",
      errorMessage: body.message ?? `Resend HTTP ${httpStatus}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "resend_request_failed";
    return {
      ok: false,
      httpStatus: 0,
      errorCode: err instanceof DOMException && err.name === "AbortError"
        ? "resend_timeout"
        : "resend_request_failed",
      errorMessage: message,
    };
  }
}
