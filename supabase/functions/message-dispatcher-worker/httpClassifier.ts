/** Maps provider HTTP outcomes to report RPC retryable flag (design §4.6, tasks 63, 68). */

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503]);

export type MessageChannel = "email" | "push";

export interface ProviderFailureClassification {
  retryable: boolean;
  errorCode: string;
}

export function isRetryableProviderFailure(
  httpStatus: number,
  errorCode?: string | null,
): boolean {
  if (isInvalidFcmTokenError(httpStatus, errorCode)) return false;
  if (isTerminalResendError(httpStatus, errorCode)) return false;
  if (RETRYABLE_HTTP_STATUSES.has(httpStatus)) return true;
  if (httpStatus === 0 && errorCode?.includes("timeout")) return true;
  return false;
}

export function isInvalidFcmTokenError(
  httpStatus: number,
  errorCode?: string | null,
): boolean {
  const code = (errorCode ?? "").toLowerCase();
  if (httpStatus === 404) return true;
  if (code === "invalid_token" || code.includes("unregistered")) return true;
  if (code.includes("not_found") || (code.includes("invalid") && code.includes("token"))) {
    return true;
  }
  return false;
}

export function isTerminalResendError(
  httpStatus: number,
  errorCode?: string | null,
): boolean {
  const code = (errorCode ?? "").toLowerCase();
  if (httpStatus === 400 || httpStatus === 422) return true;
  if (code === "validation_error") return true;
  if (code.includes("invalid") && (code.includes("email") || code.includes("recipient"))) {
    return true;
  }
  return false;
}

export function normalizeFcmErrorCode(
  httpStatus: number,
  errorCode?: string | null,
): string {
  if (isInvalidFcmTokenError(httpStatus, errorCode)) return "invalid_token";
  if (httpStatus === 0 && (errorCode ?? "").includes("timeout")) return "fcm_timeout";
  return errorCode ?? "fcm_send_failed";
}

export function normalizeResendErrorCode(
  httpStatus: number,
  errorCode?: string | null,
): string {
  if (isTerminalResendError(httpStatus, errorCode)) {
    const code = (errorCode ?? "").toLowerCase();
    if (httpStatus === 422 || code === "validation_error") return "validation_error";
    if (code.includes("email") || code.includes("recipient")) return "invalid_email";
    return errorCode ?? "resend_terminal";
  }
  if (httpStatus === 0 && (errorCode ?? "").includes("timeout")) return "resend_timeout";
  return errorCode ?? "resend_send_failed";
}

/** Channel-aware HTTP → retryable/terminal before report RPC (design §4.6, task 68). */
export function classifyProviderFailure(
  channel: MessageChannel,
  httpStatus: number,
  errorCode?: string | null,
): ProviderFailureClassification {
  const normalized = channel === "push"
    ? normalizeFcmErrorCode(httpStatus, errorCode)
    : normalizeResendErrorCode(httpStatus, errorCode);

  return {
    retryable: isRetryableProviderFailure(httpStatus, normalized),
    errorCode: normalized,
  };
}
