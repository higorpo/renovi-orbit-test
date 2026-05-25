import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  CancelDispatchParams,
  CancelDispatchResult,
  MessageDispatchStatus,
} from "../types/notifications.types";

interface CancelRpcResult {
  dispatch_id?: string;
  status?: string;
}

export interface CancelDispatchApiResult {
  result: CancelDispatchResult | null;
  error: string | null;
}

export async function cancelDispatch(
  params: CancelDispatchParams,
): Promise<CancelDispatchApiResult> {
  try {
    const { data, error } = await supabase.schema("message_dispatcher").rpc(
      "message_dispatcher_cancel",
      {
        p_dispatch_id: params.dispatchId,
        p_reason: params.reason,
      },
    );

    if (error) {
      logger.error("mmd_cancel_rpc_error", {
        error: error.message,
        dispatchId: params.dispatchId,
      });
      return { result: null, error: error.message };
    }

    const payload = data as CancelRpcResult | null;
    if (!payload?.dispatch_id) {
      logger.error("mmd_cancel_response_error", { dispatchId: params.dispatchId });
      return { result: null, error: "cancel_failed" };
    }

    return {
      result: {
        dispatchId: payload.dispatch_id,
        status: (payload.status ?? "CANCELED") as MessageDispatchStatus,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    logger.error("mmd_cancel_network_error", { error: message, dispatchId: params.dispatchId });
    return { result: null, error: message };
  }
}
