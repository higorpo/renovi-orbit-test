import {
  buildResendFromAddress,
  ResendConfigError,
} from "../message-dispatcher-worker/resend.ts";
import {
  fetchWithTimeout,
  PROVIDER_HTTP_TIMEOUT_MS,
} from "../_shared/providerHttp.ts";
import type { KycEmailAttachment } from "./types.ts";

export const RESEND_API_URL = "https://api.resend.com/emails";
export const NETCRED_CREDENCIAMENTO_EMAIL_ENV = "NETCRED_CREDENCIAMENTO_EMAIL";
export const DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL = "credenciamento@prestway.com";

export type SendCredenciamentoEmailInput = {
  recipientEmail: string;
  subject: string;
  html: string;
  attachments: KycEmailAttachment[];
  correlationId: string;
};

export type SendCredenciamentoEmailResult =
  | { ok: true; vendorMessageId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export function resolveCredenciamentoRecipientEmail(): string {
  const configured = Deno.env.get(NETCRED_CREDENCIAMENTO_EMAIL_ENV)?.trim();
  return configured || DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL;
}

export function buildCredenciamentoEmailPayload(
  input: SendCredenciamentoEmailInput,
): Record<string, unknown> {
  return {
    from: buildResendFromAddress(),
    to: [input.recipientEmail],
    subject: input.subject,
    html: input.html,
    attachments: input.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.contentBase64,
    })),
  };
}

export async function sendCredenciamentoEmail(
  input: SendCredenciamentoEmailInput,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<SendCredenciamentoEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey?.trim()) {
    throw new ResendConfigError("RESEND_API_KEY is required");
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? PROVIDER_HTTP_TIMEOUT_MS;

  try {
    const response = await fetchWithTimeout(
      RESEND_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.correlationId,
        },
        body: JSON.stringify(buildCredenciamentoEmailPayload(input)),
      },
      { timeoutMs, fetchFn },
    );

    const bodyText = await response.text();
    let body: { id?: string; message?: string; name?: string } = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      body = { message: bodyText };
    }

    if (response.ok && body.id) {
      return { ok: true, vendorMessageId: body.id };
    }

    return {
      ok: false,
      errorCode: body.name ?? "resend_send_failed",
      errorMessage: body.message ?? `Resend HTTP ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "resend_request_failed";
    return {
      ok: false,
      errorCode: err instanceof DOMException && err.name === "AbortError"
        ? "resend_timeout"
        : "resend_request_failed",
      errorMessage: message,
    };
  }
}
