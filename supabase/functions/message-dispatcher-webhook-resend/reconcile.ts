import type { SupabaseClient } from "@supabase/supabase-js";
import { SVIX_ID_HEADER } from "./svix.ts";
import type { ResendWebhookEvent } from "./types.ts";

export interface ReconcileVendorEventInput {
  vendorEventId: string;
  event: ResendWebhookEvent;
  rawPayload: Record<string, unknown>;
}

export interface ReconcileVendorEventResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export function extractSvixEventId(req: Request): string | null {
  return req.headers.get(SVIX_ID_HEADER)?.trim() ?? null;
}

export function extractResendVendorMessageId(event: ResendWebhookEvent): string | null {
  const data = event.data;
  if (!data) return null;

  const candidate = data.email_id ?? data.id;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }

  return null;
}

export async function reconcileResendVendorEvent(
  supabase: SupabaseClient,
  input: ReconcileVendorEventInput,
): Promise<ReconcileVendorEventResult> {
  const vendorMessageId = extractResendVendorMessageId(input.event);

  const { data, error } = await supabase.schema("message_dispatcher").rpc(
    "message_dispatcher_reconcile_vendor_event",
    {
      p_vendor_event_id: input.vendorEventId,
      p_vendor: "resend",
      p_event_type: input.event.type,
      p_vendor_message_id: vendorMessageId,
      p_payload: input.rawPayload,
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as Record<string, unknown> };
}
