import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import type { Json } from "../_shared/database.types.ts";
import type { IngestDispatchBody } from "./types.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500, cors);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }

  let body: IngestDispatchBody;
  try {
    body = (await req.json()) as IngestDispatchBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  if (!body.profileId || !body.channel || !body.templateKey || !body.idempotencyKey) {
    return jsonResponse({ error: "missing_required_fields" }, 400, cors);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }

  if (userData.user.id !== body.profileId) {
    return jsonResponse({ error: "forbidden" }, 403, cors);
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.schema("message_dispatcher").rpc(
    "message_dispatcher_ingest",
    {
      p_idempotency_key: body.idempotencyKey,
      p_profile_id: body.profileId,
      p_channel: body.channel,
      p_template_key: body.templateKey,
      p_template_variables: (body.templateVariables ?? {}) as Json,
      p_scheduled_for: body.scheduledFor,
      p_source_system: body.sourceSystem ?? "orbit",
      p_metadata: (body.metadata ?? {}) as Json,
    },
  );

  if (error) {
    return jsonResponse({ error: error.message, code: error.code }, 400, cors);
  }

  return jsonResponse(data, 200, cors);
});
