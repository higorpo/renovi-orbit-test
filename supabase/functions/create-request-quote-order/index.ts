/**
 * create-request-quote-order Edge Function
 * Creates full order: validate user, create address (if new), upload photos, create service_request.
 * With session: auth.uid() === userId. Without session: user exists + email match (no created_at window).
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIP, getUserIdFromRequest } from "../_shared/rateLimiter.ts";

import { corsHeaders, RATE_LIMIT_PER_MINUTE } from "./constants.ts";
import type { CreateOrderSuccess } from "./types.ts";
import { parseFormData } from "./parseFormData.ts";
import { validateRequestUser } from "./validateRequestUser.ts";
import { createAddress } from "./createAddress.ts";
import { uploadPhotos } from "./uploadPhotos.ts";
import { createServiceRequest } from "./createServiceRequest.ts";

const RATE_LIMIT_CONFIG = { perMinute: RATE_LIMIT_PER_MINUTE };

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(extraHeaders ?? {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Erro de configuração." }, 500);
  }

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

  const validation = await validateRequestUser(req, data.userId, data.email);
  if (!validation.ok) {
    return jsonResponse({ error: validation.message }, validation.status);
  }

  let addressId: string | null = null;
  let city: string;
  let neighborhood: string;

  if (data.address.kind === "existing") {
    addressId = data.address.addressId;
    city = data.address.city;
    neighborhood = data.address.neighborhood;
  } else {
    const addrResult = await createAddress(
      supabaseUrl,
      supabaseKey,
      data.userId,
      data.address
    );
    if (!addrResult.ok) {
      return jsonResponse({ error: addrResult.error }, 400);
    }
    addressId = addrResult.addressId;
    city = addrResult.city;
    neighborhood = addrResult.neighborhood;
  }

  // Use public URL for storage links so frontend gets correct host (SUPABASE_URL in Edge Functions can be internal e.g. kong:8000).
  const supabaseUrlForStorage = (() => {
    const publicUrl = Deno.env.get("SUPABASE_PUBLIC_URL");
    if (publicUrl) return publicUrl;
    try {
      const u = new URL(supabaseUrl);
      if (u.hostname === "kong" || u.hostname === "127.0.0.1") return "http://127.0.0.1:54321";
    } catch {
      /* ignore */
    }
    return supabaseUrl;
  })();

  const photoResult = await uploadPhotos(
    supabaseUrl,
    supabaseKey,
    supabaseUrlForStorage,
    data.userId,
    data.photoFiles
  );
  if (!photoResult.ok) {
    return jsonResponse({ error: photoResult.error }, 400);
  }

  const reqResult = await createServiceRequest(
    supabaseUrl,
    supabaseKey,
    {
      client_id: data.userId,
      service_id: data.serviceId,
      address_id: addressId,
      service_title: data.serviceTitle,
      description: data.description,
      photoUrls: photoResult.urls,
      form_data: data.formData,
      form_schema: data.formSchema,
      form_version: data.formVersion,
      city,
      neighborhood,
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
