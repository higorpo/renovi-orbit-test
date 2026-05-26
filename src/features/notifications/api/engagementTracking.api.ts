import type { Json } from "@/lib/supabase/database.types";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export interface RecordPushClickParams {
  dispatchId: string;
  metadata?: Record<string, unknown>;
}

export interface RecordPushClickResult {
  applied: boolean;
  firstEngagement: boolean;
}

interface RecordPushClickRpcResult {
  applied?: boolean;
  first_engagement?: boolean;
}

export async function recordPushClick(
  params: RecordPushClickParams,
): Promise<RecordPushClickResult> {
  const { data, error } = await supabase
    .schema("message_dispatcher")
    .rpc("message_dispatcher_record_push_click", {
      p_dispatch_id: params.dispatchId,
      p_metadata: (params.metadata ?? {}) as Json,
    });

  if (error) {
    logger.error("mmd_record_push_click_rpc_error", {
      error: error.message,
      dispatchId: params.dispatchId,
    });
    throw error;
  }

  const result = data as RecordPushClickRpcResult | null;
  return {
    applied: result?.applied ?? false,
    firstEngagement: result?.first_engagement ?? false,
  };
}
