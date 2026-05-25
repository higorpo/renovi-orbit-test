import type { Database } from "@/lib/supabase/database.types";

export type MessageChannel =
  Database["message_dispatcher"]["Enums"]["message_channel"];

export type MessageDispatchStatus =
  Database["message_dispatcher"]["Enums"]["message_dispatch_status"];

export interface IngestDispatchParams {
  profileId: string;
  channel: MessageChannel;
  templateKey: string;
  templateVariables?: Record<string, unknown>;
  idempotencyKey?: string;
  scheduledFor?: string;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestDispatchResult {
  dispatchId: string;
  status: MessageDispatchStatus;
  scheduledFor: string;
  duplicate: boolean;
}

export interface CancelDispatchParams {
  dispatchId: string;
  reason?: string;
}

export interface CancelDispatchResult {
  dispatchId: string;
  status: MessageDispatchStatus;
}

export interface AuditTimelineEntry {
  id: number;
  dispatch_id: string;
  profile_id: string;
  old_status: MessageDispatchStatus | null;
  new_status: MessageDispatchStatus;
  changed_by: string;
  correlation_id: string | null;
  delta: Record<string, unknown>;
  created_at: string;
}
