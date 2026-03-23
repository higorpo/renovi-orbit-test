import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  validateRecaptchaToken,
  type RecaptchaAction,
} from "../_shared/recaptcha.ts";

interface RequestBody {
  token?: string;
  action?: RecaptchaAction;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Método não permitido." }, 405);
  }

  const payload = (await req.json().catch(() => ({}))) as RequestBody;
  if (!payload.action || !payload.token) {
    return jsonResponse(
      { success: false, message: "Token e action do reCAPTCHA são obrigatórios." },
      400
    );
  }

  const validation = await validateRecaptchaToken(payload.token, payload.action);
  if (!validation.success) {
    return jsonResponse(
      { success: false, message: validation.message ?? "Falha de validação do reCAPTCHA." },
      400
    );
  }

  return jsonResponse({
    success: true,
    message: validation.skipped
      ? "Validação de reCAPTCHA ignorada (sem segredo configurado)."
      : "reCAPTCHA validado.",
  });
});
