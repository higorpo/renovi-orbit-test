/**
 * Edge Function: message-dispatcher-webhook-resend (design §5.6).
 *
 * Resend delivery/bounce ingress → Svix verify → reconcile_vendor_event (task 78).
 */

import "xhr";
import { serve } from "std/http/server";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createLogger } from "../_shared/logger.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import { extractSvixEventId, reconcileResendVendorEvent } from "./reconcile.ts";
import { parseResendWebhookPayload } from "./types.ts";
import { verifyResendWebhookRequest } from "./svix.ts";

const log = createLogger("message-dispatcher-webhook-resend");

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    log.warn("webhook.method_not_allowed", { method: req.method });
    return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  const rawBody = await req.text();
  const verify = await verifyResendWebhookRequest(req, rawBody);

  if (!verify.ok) {
    log.warn("webhook.verify_failed", { code: verify.code, status: verify.status });
    return jsonResponse({ error: verify.code }, verify.status, corsHeaders);
  }

  const event = parseResendWebhookPayload(rawBody);
  if (!event) {
    log.warn("webhook.invalid_payload");
    return jsonResponse({ error: "invalid_payload" }, 400, corsHeaders);
  }

  const vendorEventId = extractSvixEventId(req);
  if (!vendorEventId) {
    log.warn("webhook.missing_svix_id");
    return jsonResponse({ error: "svix_id_missing" }, 400, corsHeaders);
  }

  const rawPayload = event as unknown as Record<string, unknown>;

  try {
    const supabase = createServiceRoleClient();
    const reconcile = await reconcileResendVendorEvent(supabase, {
      vendorEventId,
      event,
      rawPayload,
    });

    if (!reconcile.ok) {
      log.error("webhook.reconcile_failed", {
        event_type: event.type,
        vendor_event_id: vendorEventId,
        error: reconcile.error,
      });
      return jsonResponse({ error: "reconcile_failed" }, 500, corsHeaders);
    }

    log.info("webhook.reconcile_applied", {
      event_type: event.type,
      vendor_event_id: vendorEventId,
      result: reconcile.data,
    });

    return jsonResponse(
      { accepted: true, reconcile: reconcile.data },
      200,
      corsHeaders,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook_handler_failed";
    log.error("webhook.handler_exception", { error: message });
    return jsonResponse({ error: "webhook_handler_failed" }, 500, corsHeaders);
  }
});
