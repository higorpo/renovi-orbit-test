import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import type { PaymentsApiError, PaymentsApiResult } from "../types/paymentApi.types";
import { mapPaymentRpcError } from "../utils/paymentApiErrors";
import type { PaymentEdgeFunctionName } from "./payments.edge";
import type { PaymentRpcName } from "./payments.rpc";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string; details?: string; code?: string } | null;
  }>;
};

function getRpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function trackPaymentApiError(source: string, code: string): void {
  logger.error("payments_api_error", { source, code });
  metrics.count("payments.api_error", 1, { source, code });
}

export async function invokePaymentRpc<T>(
  rpc: PaymentRpcName,
  args: Record<string, unknown>,
  validate: (data: unknown) => data is T,
  invalidLogKey: string,
): Promise<PaymentsApiResult<T>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(rpc, args);

  if (error) {
    const mapped = mapPaymentRpcError(error);
    trackPaymentApiError(rpc, mapped.code);
    return { data: null, error: mapped };
  }

  if (!validate(data)) {
    logger.error(invalidLogKey, { rpc, data });
    trackPaymentApiError(rpc, "INVALID_RESPONSE");
    return {
      data: null,
      error: {
        code: "INVALID_RESPONSE",
        message: "Resposta inesperada do servidor.",
      },
    };
  }

  return { data, error: null };
}

export type PaymentEdgeInvokeResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
};

async function readPaymentEdgeErrorPayload(error: FunctionsHttpError): Promise<{
  payload: Record<string, unknown>;
  status: number;
}> {
  let payload: Record<string, unknown> = {};
  let status = 500;

  try {
    const context = error.context;
    if (context) {
      status = context.status ?? status;
      if (typeof context.json === "function") {
        payload = toRecord(await context.json());
      }
    }
  } catch {
    // fall through to generic message
  }

  return { payload, status };
}

export async function invokePaymentEdgeFunction(
  functionName: PaymentEdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<PaymentEdgeInvokeResult> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    ...(body !== undefined ? { body } : {}),
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const { payload, status } = await readPaymentEdgeErrorPayload(error);
      const { errorCode } = mapEdgeErrorPayload(payload, error.message);
      trackPaymentApiError(functionName, errorCode ?? error.message);
      return { ok: false, status, payload };
    }

    trackPaymentApiError(functionName, error.message);
    return {
      ok: false,
      status: 500,
      payload: { error: error.message },
    };
  }

  const payload = toRecord(data);

  if (typeof payload.error === "string" || typeof payload.error_code === "string") {
    const { errorCode } = mapEdgeErrorPayload(payload, "Edge function returned an error");
    trackPaymentApiError(functionName, errorCode ?? "EDGE_ERROR");
    return { ok: false, status: 400, payload };
  }

  return { ok: true, status: 200, payload };
}

export function mapEdgeErrorPayload(
  payload: Record<string, unknown>,
  fallbackMessage: string,
): { message: string; errorCode?: string; field?: string } {
  const errorCode = typeof payload.error_code === "string" ? payload.error_code : undefined;
  const field = typeof payload.field === "string" ? payload.field : undefined;
  const message =
    errorCode
    ?? (typeof payload.error === "string" ? payload.error : fallbackMessage);

  return { message, errorCode, field };
}

export function paymentsApiErrorToMessage(error: PaymentsApiError | null): string | null {
  return error?.message ?? null;
}
