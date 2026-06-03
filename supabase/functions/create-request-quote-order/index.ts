/**
 * create-request-quote-order Edge Function
 * Creates full order: validate user, create address (if new), upload photos, create service_request.
 * With session: auth.uid() === userId. Without session: user exists + email match (no created_at window).
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIP, getUserIdFromRequest } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";

import { RATE_LIMIT_PER_MINUTE } from "./constants.ts";
import type { CreateOrderSuccess } from "./types.ts";
import { parseFormData } from "./parseFormData.ts";
import { validateRequestUser } from "./validateRequestUser.ts";
import { createAddress } from "./createAddress.ts";
import { uploadPhotos } from "./uploadPhotos.ts";
import { createServiceRequest } from "./createServiceRequest.ts";
import { validateRecaptchaToken } from "../_shared/recaptcha.ts";

const RATE_LIMIT_CONFIG = { perMinute: RATE_LIMIT_PER_MINUTE };

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders, ...(extraHeaders ?? {}) },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabase = createServiceRoleClient();

  const clientIP = getClientIP(req);
  const userIdFromAuth = await getUserIdFromRequest(req);
  const rl = await checkRateLimit(
    clientIP,
    userIdFromAuth,
    "create-request-quote-order",
    RATE_LIMIT_CONFIG
  );

  if (!rl.allowed) {
    console.log(`[RateLimit] Blocked: IP=${clientIP}, User=${userIdFromAuth}`);
    return jsonResponse(
      {
        error: "rate_limited",
        message: "Muitas requisições. Tente novamente em alguns minutos.",
        retryAfter: rl.retryAfter,
      },
      429,
      { "Retry-After": String(rl.retryAfter) }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  const parseResult = await parseFormData(formData);
  if (!parseResult.ok) {
    return jsonResponse({ error: parseResult.error }, parseResult.status);
  }

  const { data } = parseResult;

  const recaptchaCheck = await validateRecaptchaToken(
    data.recaptchaToken,
    "request_quote_submit"
  );
  if (!recaptchaCheck.success) {
    return jsonResponse({ error: recaptchaCheck.message ?? "Falha no reCAPTCHA." }, 400);
  }

  const validation = await validateRequestUser(supabase, req, data.userId, data.email);
  if (!validation.ok) {
    return jsonResponse({ error: validation.message }, validation.status);
  }

  let addressId: string | null = null;

  if (data.address.kind === "existing") {
    addressId = data.address.addressId;
  } else {
    const addrResult = await createAddress(
      supabase,
      data.userId,
      data.address
    );
    if (!addrResult.ok) {
      return jsonResponse({ error: addrResult.error }, 400);
    }
    addressId = addrResult.addressId;
  }

  const photoResult = await uploadPhotos(
    supabase,
    data.userId,
    data.photoFiles
  );
  if (!photoResult.ok) {
    return jsonResponse({ error: photoResult.error }, 400);
  }

  const reqResult = await createServiceRequest(
    supabase,
    {
      client_id: data.userId,
      service_id: data.serviceId,
      address_id: addressId,
      service_title: data.serviceTitle,
      request_title: data.serviceRequestTitle,
      description: data.description,
      photoUrls: photoResult.paths,
      form_data: data.formData,
      form_schema: data.formSchema,
      form_version: data.formVersion,
      urgency: data.structuredData?.urgency ?? null,
      scope_complexity: data.structuredData?.scope_complexity ?? null,
      tags: data.structuredData?.tags ?? null,
      missing_info_warnings: data.structuredData?.missing_info_warnings ?? null,
      suggested_equipment: data.structuredData?.suggested_equipment ?? null,
      suggested_materials: data.structuredData?.suggested_materials ?? null,
      estimated_duration_hint: data.structuredData?.estimated_duration_hint ?? null,
    }
  );

  if (!reqResult.ok) {
    console.error("[create-request-quote-order]", reqResult.error);
    return jsonResponse({ error: "Erro ao criar o pedido. Tente novamente." }, 500);
  }

  const successBody: CreateOrderSuccess = {
    requestId: reqResult.requestId,
    addressId,
  };

  return jsonResponse(successBody, 200);
});
