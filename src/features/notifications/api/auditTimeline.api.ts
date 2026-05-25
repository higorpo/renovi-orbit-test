import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { AuditTimelineEntry } from "../types/notifications.types";

export interface FetchAuditTimelineResult {
  entries: AuditTimelineEntry[];
  error: string | null;
}

export async function fetchAuditTimeline(
  dispatchId: string,
): Promise<FetchAuditTimelineResult> {
  const { data, error } = await supabase.schema("message_dispatcher").rpc(
    "message_dispatcher_audit_timeline",
    { p_dispatch_id: dispatchId },
  );

  if (error) {
    logger.error("mmd_audit_timeline_rpc_error", {
      error: error.message,
      dispatchId,
    });
    return { entries: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as AuditTimelineEntry[];
  return { entries: Array.isArray(rows) ? rows : [], error: null };
}
