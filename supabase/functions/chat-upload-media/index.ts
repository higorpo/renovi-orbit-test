/**
 * chat-upload-media Edge Function (design §5.2, §10.1; tasks 54, 65).
 * Two-phase upload: validate session → Storage put → client calls cns_send_message with paths.
 */

import "xhr";
import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIP, getUserIdFromRequest } from "../_shared/rateLimiter.ts";
import { initSentryEdge, withSpan } from "../_shared/sentrySpans.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import { buildUploadLogContext } from "./buildUploadLogContext.ts";
import { RATE_LIMIT_PER_MINUTE } from "./constants.ts";
import { parseFormData } from "./parseFormData.ts";
import type { UploadChatMediaSuccess, ValidateUploadSessionResult } from "./types.ts";
import { uploadChatMedia } from "./uploadChatMedia.ts";

const logger = createLogger("chat-upload-media");
const RATE_LIMIT_CONFIG = { perMinute: RATE_LIMIT_PER_MINUTE, failClosed: true };

function resolveCorrelationId(req: Request): string {
  const header = req.headers.get("x-correlation-id")?.trim();
  return header && header.length > 0 ? header : crypto.randomUUID();
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const correlationId = resolveCorrelationId(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  await initSentryEdge("chat-upload-media");

  return withSpan(
    "chat-upload-media.handle",
    "function",
    { correlation_id: correlationId },
    async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!supabaseUrl || !anonKey) {
        logger.error("server_misconfigured", buildUploadLogContext({
          correlationId,
          eventType: "server_misconfigured",
        }));
        return jsonResponse({ error: "server_misconfigured" }, 500, cors);
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "unauthorized" }, 401, cors);
      }

      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        return jsonResponse({ error: "unauthorized" }, 401, cors);
      }

      const clientIP = getClientIP(req);
      const rateLimit = await checkRateLimit(
        clientIP,
        userId,
        "chat-upload-media",
        RATE_LIMIT_CONFIG,
      );

      if (!rateLimit.allowed) {
        logger.warn("rate_limited", {
          ...buildUploadLogContext({ correlationId, eventType: "rate_limited" }),
          retry_after: rateLimit.retryAfter,
        });
        return jsonResponse(
          {
            error: "rate_limited",
            message: "Too many requests. Try again shortly.",
            retryAfter: rateLimit.retryAfter,
          },
          429,
          { ...cors, "Retry-After": String(rateLimit.retryAfter) },
        );
      }

      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return jsonResponse({ error: "invalid_multipart_body" }, 400, cors);
      }

      const parsed = parseFormData(formData);
      if (!parsed.ok) {
        return jsonResponse({ error: parsed.error }, parsed.status, cors);
      }

      const baseLogContext = buildUploadLogContext({
        correlationId,
        conversationId: parsed.chatId,
        uploadSessionId: parsed.uploadSessionId,
        idempotencyKey: parsed.idempotencyKey,
      });

      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: sessionData, error: sessionError } = await authClient.rpc(
        "cns_validate_upload_session",
        {
          p_upload_session_id: parsed.uploadSessionId,
          p_chat_id: parsed.chatId,
        },
      );

      if (sessionError) {
        const status = sessionError.code === "42501" ? 403 : 400;
        logger.warn("session_validation_failed", {
          ...baseLogContext,
          event_type: "session_validation_failed",
          code: sessionError.code,
          message: sessionError.message,
        });
        return jsonResponse(
          { error: sessionError.message, code: sessionError.code },
          status,
          cors,
        );
      }

      const session = sessionData as ValidateUploadSessionResult;

      logger.info("upload_started", {
        ...baseLogContext,
        event_type: "upload_started",
        file_count: parsed.files.length,
      });

      const admin = createServiceRoleClient();
      const uploadResult = await uploadChatMedia(
        admin,
        session.storage_path_prefix,
        parsed.files,
        baseLogContext,
        parsed.mediaKind,
      );

      if (!uploadResult.ok) {
        logger.warn("upload_failed", {
          ...baseLogContext,
          event_type: "upload_failed",
          error: uploadResult.error,
        });
        return jsonResponse({ error: uploadResult.error }, uploadResult.status, cors);
      }

      const body: UploadChatMediaSuccess = { paths: uploadResult.paths };

      logger.info("upload_completed", {
        ...baseLogContext,
        event_type: "upload_completed",
        path_count: uploadResult.paths.length,
      });

      return jsonResponse(body, 200, cors);
    },
  );
});
