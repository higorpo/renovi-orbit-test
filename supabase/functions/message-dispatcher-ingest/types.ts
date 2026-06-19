import type { Json } from "../_shared/database.types.ts";

export type MessageChannel = "email" | "push";

export interface IngestDispatchBody {
  idempotencyKey: string;
  profileId: string;
  channel: MessageChannel;
  templateKey: string;
  templateVariables?: Record<string, Json | undefined>;
  scheduledFor?: string;
  sourceSystem?: string;
  metadata?: Record<string, Json | undefined>;
}

export interface IngestDispatchRpcResult {
  dispatch_id: string;
  status: string;
  scheduled_for: string;
  duplicate: boolean;
}
