import type { PaymentsApiError } from "../types/paymentApi.types";
import { mapPaymentUserMessage } from "./mapPaymentUserMessage";

export function parsePaymentRpcDetailObject(
  details: string | undefined,
): Record<string, unknown> | null {
  if (!details) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function mapPaymentRpcError(error: {
  message: string;
  details?: string;
  code?: string;
}): PaymentsApiError {
  const detail = parsePaymentRpcDetailObject(error.details);
  const detailCode = detail?.code;
  const code =
    (typeof detailCode === "string" ? detailCode : null)
    ?? (typeof error.code === "string" ? error.code : null)
    ?? error.message
    ?? "UNKNOWN";

  const retryRaw = detail?.retry_after_seconds;
  const retryAfterSeconds =
    typeof retryRaw === "number"
      ? retryRaw
      : typeof retryRaw === "string"
        ? Number.parseInt(retryRaw, 10)
        : undefined;

  return {
    code,
    message: mapPaymentUserMessage(code, {
      fallback: "Não foi possível concluir a operação.",
    }),
    ...(Number.isFinite(retryAfterSeconds) ? { retryAfterSeconds } : {}),
  };
}
