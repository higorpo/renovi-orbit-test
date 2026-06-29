import type { ChargeError } from "./types.ts";

export const TERMINAL_GATEWAY_ERROR_CODES = new Set([
  "REJECTED",
  "CPF_INVALID",
  "BILLING_ADDRESS_MISSING",
  "CARD_NOT_FOUND",
  "REFERENCE_CODE_CONFLICT_UNRESOLVABLE",
]);

export const REFERENCE_CODE_CONFLICT_CODES = new Set([
  "REFERENCE_CODE_ALREADY_EXISTS",
  "REFERENCE_CODE_CONFLICT",
  "DUPLICATE_REFERENCE_CODE",
]);

type GraphQLErrorShape = {
  code?: string | null;
  message?: string | null;
  field?: string | null;
};

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  if (error instanceof TypeError) return true;
  return false;
}

export function is5xxStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

export function isReferenceCodeConflict(
  errors: GraphQLErrorShape[] | undefined,
): boolean {
  if (!errors?.length) return false;

  return errors.some((error) => {
    const code = (error.code ?? "").toUpperCase();
    const message = (error.message ?? "").toLowerCase();
    const field = (error.field ?? "").toLowerCase();

    if (REFERENCE_CODE_CONFLICT_CODES.has(code)) return true;
    if (code.includes("REFERENCE") && code.includes("CODE")) return true;
    if (field.includes("referencecode")) return true;
    if (message.includes("referencecode") || message.includes("reference code")) {
      return true;
    }
    return false;
  });
}

export function isTerminalGatewayError(
  errors: GraphQLErrorShape[] | undefined,
): boolean {
  if (!errors?.length) return false;

  return errors.some((error) => {
    const code = (error.code ?? "").toUpperCase();
    return TERMINAL_GATEWAY_ERROR_CODES.has(code);
  });
}

export function getPrimaryGatewayError(
  errors: GraphQLErrorShape[] | undefined,
): GraphQLErrorShape | undefined {
  return errors?.[0];
}

export function buildChargeError(
  code: ChargeError["code"],
  message: string,
  originalCode?: string,
): ChargeError {
  return { code, message, originalCode };
}

export function buildRetryableError(message: string): ChargeError {
  return buildChargeError("RETRYABLE", message);
}

export function buildTerminalError(
  message: string,
  originalCode?: string,
): ChargeError {
  return buildChargeError("TERMINAL", message, originalCode);
}
