/**
 * Generate Smart Description Edge Function
 * Requires body.serviceId (service uuid). Fetches prompt from services.ai_prompt_id; fallback to description_default or inline.
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIP, getUserIdFromRequest } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";

import { OPEN_AI_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL } from "./constants.ts";
import type { GenerateSmartDescriptionBody, PromptConfig } from "./types.ts";
import { formatFormDataToContext } from "./formContext.ts";
import { logPromptUsage } from "./usage.ts";
import {
  parseRequestParams,
  validateRequestParams,
  resolvePromptAndService,
  buildPrompts,
  callAI,
  processAIResponse,
  buildSuccessResponse,
  buildErrorResponse,
  logUsageOnError,
  jsonResponse,
} from "./handlerHelpers.ts";

const RATE_LIMIT_CONFIG = { perMinute: 60, burst: 10, failClosed: true };

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  let promptConfig: PromptConfig | null = null;
  let userId: string | null = null;

  try {
    const clientIP = getClientIP(req);
    userId = await getUserIdFromRequest(req);
    const rl = await checkRateLimit(
      clientIP,
      userId,
      "generate-smart-description",
      RATE_LIMIT_CONFIG
    );

    if (!rl.allowed) {
      console.log(`[RateLimit] Blocked: IP=${clientIP}, User=${userId}`);
      return jsonResponse(
        {
          error: "rate_limited",
          message: "Muitas requisições. Tente novamente em alguns segundos.",
          retryAfter: rl.retryAfter,
        },
        429,
        { "Retry-After": String(rl.retryAfter) },
        corsHeaders
      );
    }

    const body = (await req.json()) as GenerateSmartDescriptionBody;
    const params = parseRequestParams(body);

    console.log("📋 Request:", {
      serviceId: params.serviceId,
      formDataKeys: Object.keys(params.formData),
      formDataSize: JSON.stringify(params.formData).length,
      hasUserNotes: !!params.userNotes,
      forcePromptKey: params.forcePromptKey,
      mode: params.mode,
    });

    const validationError = validateRequestParams(params, corsHeaders);
    if (validationError) return validationError;

    const supabase = createServiceRoleClient();

    const enableStructured =
      params.mode !== "suggestion" && params.useStructuredOutput;
    console.log(
      `Mode: ${params.mode}, Structured output: ${enableStructured ? "enabled" : "disabled"}`
    );

    const { promptConfig: resolvedPromptConfig, serviceDisplayName } =
      await resolvePromptAndService(supabase, params);
    
    promptConfig = resolvedPromptConfig;

    console.log(
      `✅ Using prompt: ${promptConfig.name} (v${promptConfig.version})`
    );
    console.log(
      `[Config] Provider=${params.provider}, Model=${params.provider === "gemini" ? GEMINI_DEFAULT_MODEL : OPEN_AI_DEFAULT_MODEL}, temp=${promptConfig.temperature}, max_tokens=${promptConfig.max_tokens}`
    );

    const context = formatFormDataToContext({
      serviceName: serviceDisplayName,
      formData: params.formData,
      userNotes: params.userNotes,
      mode: params.mode,
      formSchema: params.formSchema,
    });
    console.log("📤 Context prepared:", context.substring(0, 200) + "...");

    const { systemPrompt, userPrompt } = buildPrompts({
      promptConfig,
      context,
      mode: params.mode,
      enableStructured,
      serviceDisplayName,
    });

    const { rawContent, tokensUsed } = await callAI({
      provider: params.provider,
      systemPrompt,
      userPrompt,
      promptConfig,
      enableStructured,
    });

    const generationTime = Date.now() - startTime;
    const modelLabel =
      params.provider === "gemini" ? GEMINI_DEFAULT_MODEL : OPEN_AI_DEFAULT_MODEL;
    console.log(
      `[${params.provider}] Model: ${modelLabel}, Temperature: ${enableStructured ? Math.min(promptConfig.temperature, 0.3) : promptConfig.temperature} (${enableStructured ? "structured" : "normal"})`
    );

    const { processedDescription, structuredResponse } = processAIResponse({
      rawContent,
      mode: params.mode,
      enableStructured,
      serviceDisplayName,
      formattingRules: promptConfig.formatting_rules,
    });

    console.log(
      `✅ Generated in ${generationTime}ms, ${tokensUsed} tokens, ${processedDescription.length} chars`
    );

    await logPromptUsage(
      supabase,
      promptConfig.id,
      userId,
      params.serviceRequestId,
      true,
      tokensUsed,
      generationTime
    );

    return buildSuccessResponse(
      {
        processedDescription,
        rawContent,
        promptConfig,
        tokensUsed,
        generationTime,
        mode: params.mode,
        enableStructured,
        structuredResponse,
        provider: params.provider,
      },
      corsHeaders
    );
  } catch (error: unknown) {
    const generationTime = Date.now() - startTime;
    const errMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Error:", errMessage);

    if (promptConfig) {
      const supabase = createServiceRoleClient();

      await logUsageOnError(
        supabase,
        promptConfig,
        userId,
        generationTime,
        errMessage
      );
    }

    return buildErrorResponse(errMessage, corsHeaders);
  }
});
