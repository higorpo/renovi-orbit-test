import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import type { ProviderKycEdgeName, ProviderKycRpcName } from "./providerKyc.rpc";

export type ProviderKycApiError = {
  code: string;
  message: string;
  field?: string;
};

export type ProviderKycApiResult<T> = {
  data: T | null;
  error: ProviderKycApiError | null;
};

export type ProviderKycEdgeInvokeResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
};

const DEFAULT_KYC_USER_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";

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

function trackProviderKycApiError(source: string, code: string): void {
  logger.error("provider_kyc_api_error", { source, code });
  metrics.count("provider_kyc.api_error", 1, { source, code });
}

function parseRpcDetailObject(
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

function mapRpcError(error: {
  message: string;
  details?: string;
  code?: string;
}): ProviderKycApiError {
  const detail = parseRpcDetailObject(error.details);
  const detailCode = detail?.code;
  const code =
    (typeof detailCode === "string" ? detailCode : null)
    ?? (typeof error.code === "string" ? error.code : null)
    ?? error.message
    ?? "UNKNOWN";

  return {
    code,
    message: DEFAULT_KYC_USER_MESSAGE,
  };
}

export async function invokeProviderKycRpc<T>(
  rpc: ProviderKycRpcName,
  args: Record<string, unknown>,
  validate: (data: unknown) => data is T,
  invalidLogKey: string,
): Promise<ProviderKycApiResult<T>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(rpc, args);

  if (error) {
    const mapped = mapRpcError(error);
    trackProviderKycApiError(rpc, mapped.code);
    return { data: null, error: mapped };
  }

  if (!validate(data)) {
    logger.error(invalidLogKey, { rpc, data });
    trackProviderKycApiError(rpc, "INVALID_RESPONSE");
    return {
      data: null,
      error: {
        code: "INVALID_RESPONSE",
        message: "Resposta inesperada do servidor. Tente novamente.",
      },
    };
  }

  return { data, error: null };
}

async function readEdgeErrorPayload(error: FunctionsHttpError): Promise<{
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

export async function invokeProviderKycEdgeFunction(
  functionName: ProviderKycEdgeName,
  body?: Record<string, unknown>,
): Promise<ProviderKycEdgeInvokeResult> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    ...(body !== undefined ? { body } : {}),
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const { payload, status } = await readEdgeErrorPayload(error);
      const { errorCode } = mapEdgeErrorPayload(payload, error.message);
      trackProviderKycApiError(functionName, errorCode ?? error.message);
      return { ok: false, status, payload };
    }

    trackProviderKycApiError(functionName, error.message);
    return {
      ok: false,
      status: 500,
      payload: { error: error.message },
    };
  }

  const payload = toRecord(data);

  if (typeof payload.error === "string" || typeof payload.error_code === "string") {
    const { errorCode } = mapEdgeErrorPayload(payload, "Edge function returned an error");
    trackProviderKycApiError(functionName, errorCode ?? "EDGE_ERROR");
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

export function providerKycApiErrorToMessage(error: ProviderKycApiError | null): string | null {
  return error?.message ?? null;
}
