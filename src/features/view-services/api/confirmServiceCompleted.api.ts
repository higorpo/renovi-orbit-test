import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/parseRpcDetail";
import { mapServiceCompletionErrorMessage } from "../utils/mapServiceCompletionError";

export type ConfirmServiceCompletedSuccess = {
  serviceId: string;
  status: string;
  completedAt: string;
};

export type ConfirmServiceCompletedResult = {
  data: ConfirmServiceCompletedSuccess | null;
  error: string | null;
  errorCode?: string;
};

type RpcSuccessResponse = {
  service_id: string;
  status: string;
  completed_at: string;
};

export async function confirmServiceCompleted(
  contractedServiceId: string,
): Promise<ConfirmServiceCompletedResult> {
  const { data, error } = await supabase.rpc("payment_confirm_service_completed", {
    p_service_id: contractedServiceId,
  });

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("payment_confirm_service_completed_failed", {
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
      completedAt: payload.completed_at,
    },
    error: null,
  };
}
