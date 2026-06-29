import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/parseRpcDetail";
import { mapServiceCompletionErrorMessage } from "../utils/mapServiceCompletionError";

export type MarkServiceExecutedSuccess = {
  serviceId: string;
  status: string;
  executedAt: string;
};

export type MarkServiceExecutedResult = {
  data: MarkServiceExecutedSuccess | null;
  error: string | null;
  errorCode?: string;
};

type RpcSuccessResponse = {
  service_id: string;
  status: string;
  executed_at: string;
};

export async function markServiceExecuted(
  contractedServiceId: string,
): Promise<MarkServiceExecutedResult> {
  const { data, error } = await supabase.rpc("payment_mark_service_executed", {
    p_service_id: contractedServiceId,
  });

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("payment_mark_service_executed_failed", {
      contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: mapServiceCompletionErrorMessage(errorCode),
      errorCode,
    };
  }

  const payload = data as RpcSuccessResponse;

  return {
    data: {
      serviceId: payload.service_id,
      status: payload.status,
      executedAt: payload.executed_at,
    },
    error: null,
  };
}
