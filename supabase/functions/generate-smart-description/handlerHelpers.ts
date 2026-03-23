import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type {
  PromptConfig,
  StructuredAIResponse,
  GenerateSmartDescriptionBody,
  ParsedRequestParams,
  ResolvedPromptResult,
  ProcessedAIResult,
  SmartDescriptionMode,
  SmartDescriptionProvider,
} from "./types.ts";
import { corsHeaders, OPEN_AI_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL } from "./constants.ts";
import { formatProfessionalDescription, postProcessDescription } from "./formatting.ts";
import { logPromptUsage } from "./usage.ts";
import {
  validateStructuredResponse,
  generateFallbackResponse,
  stripJsonCodeFence,
  unwrapNestedStructuredResponse,
} from "./structured.ts";
import {
  getSuggestionSystemPrompt,
  getSuggestionUserPrompt,
  getStructuredSystemPrompt,
  getStructuredUserPrompt,
} from "./promptTemplates.ts";
import { getPromptById, getPromptFromDB } from "./prompt.ts";
import { Database } from "../_shared/database.types.ts";

const DEFAULT_SERVICE_DISPLAY_NAME = "Serviço não identificado";

function getDefaultPromptConfig(): PromptConfig {
  return {
    id: "default-inline",
    prompt_key: "description_default",
    name: "Descrição padrão",
    system_prompt: `Você é um assistente que gera descrições profissionais de solicitações de serviço para uma plataforma de orçamentos.
Gere uma descrição clara, em português brasileiro, com as seções: RESUMO DO SERVIÇO, DESCRIÇÃO DETALHADA e SUGESTÕES.
Use APENAS as informações fornecidas no contexto. Não invente dados.
Formato: texto puro, sem markdown.`,
    max_tokens: 1500,
    temperature: 0.3,
    formatting_rules: {
      use_caps_titles: true,
      use_block_separation: true,
      allow_markdown: false,
    },
    version: 1,
  };
}

export function parseRequestParams(
  body: GenerateSmartDescriptionBody
): ParsedRequestParams {
  return {
    serviceId: body.serviceId ?? "",
    formData: body.formData ?? {},
    userNotes: body.userNotes ?? "",
    serviceRequestId: body.serviceRequestId ?? null,
    forcePromptKey: body.forcePromptKey ?? null,
    useStructuredOutput: body.useStructuredOutput !== false,
    mode: body.mode ?? "full_description",
    formSchema: body.formSchema ?? null,
    provider: body.provider ?? "gemini",
  };
}

export function validateRequestParams(
  params: ParsedRequestParams,
  cors?: Record<string, string>
): Response | null {
  if (params.serviceId) return null;
  return jsonResponse(
    { error: "service é obrigatório (id do serviço)" },
    400,
    undefined,
    cors
  );
}

export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
  cors?: Record<string, string>
): Response {
  const headers = { ...(cors ?? corsHeaders), "Content-Type": "application/json", ...extraHeaders };
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export async function resolvePromptAndService(
  supabase: SupabaseClient<Database>,
  params: ParsedRequestParams
): Promise<ResolvedPromptResult> {
  const { serviceId, forcePromptKey } = params;
  let promptConfig: PromptConfig | null = null;
  let serviceDisplayName = DEFAULT_SERVICE_DISPLAY_NAME;

  if (forcePromptKey) {
    promptConfig = await getPromptFromDB(supabase, forcePromptKey);
  } else {
    const { data: serviceRow, error: serviceError } = await supabase
      .from("platform_services")
      .select("id, ai_prompt_id, slug, title")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) console.warn("[Service] Fetch error:", serviceError);
    if (serviceRow) {
      serviceDisplayName =
        (serviceRow.title ?? serviceRow.slug ?? DEFAULT_SERVICE_DISPLAY_NAME) as string;
      if (serviceRow.ai_prompt_id) {
        promptConfig = await getPromptById(
          supabase,
          serviceRow.ai_prompt_id as string
        );
      }
    }
  }

  if (!promptConfig) {
    console.warn("⚠️ No prompt found, using inline default (Orbit fallback)");
    promptConfig = getDefaultPromptConfig();
  }

  return { promptConfig, serviceDisplayName };
}

export function buildPrompts(params: {
  promptConfig: PromptConfig;
  context: string;
  mode: SmartDescriptionMode;
  enableStructured: boolean;
  serviceDisplayName: string;
}): { systemPrompt: string; userPrompt: string } {
  const { promptConfig, context, mode, enableStructured, serviceDisplayName } = params;
  let systemPrompt = promptConfig.system_prompt;
  let userPrompt = context;

  if (mode === "suggestion") {
    systemPrompt = getSuggestionSystemPrompt();
    userPrompt = getSuggestionUserPrompt(context);
  } else if (enableStructured) {
    systemPrompt = getStructuredSystemPrompt(systemPrompt, serviceDisplayName);
    userPrompt = getStructuredUserPrompt(context);
  }

  return { systemPrompt, userPrompt };
}

export async function callOpenAI(params: {
  systemPrompt: string;
  userPrompt: string;
  promptConfig: PromptConfig;
  enableStructured: boolean;
}): Promise<{ rawContent: string; tokensUsed?: number }> {
  const { systemPrompt, userPrompt, promptConfig, enableStructured } = params;
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Defina o secret no projeto Supabase."
    );
  }

  const temperature = enableStructured
    ? Math.min(promptConfig.temperature, 0.3)
    : promptConfig.temperature;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPEN_AI_DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: promptConfig.max_tokens,
      temperature,
      ...(enableStructured ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens;

  return { rawContent, tokensUsed };
}

export async function callGemini(params: {
  systemPrompt: string;
  userPrompt: string;
  promptConfig: PromptConfig;
  enableStructured: boolean;
}): Promise<{ rawContent: string; tokensUsed?: number }> {
  const { systemPrompt, userPrompt, promptConfig, enableStructured } = params;
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Defina o secret no projeto Supabase."
    );
  }

  const temperature = enableStructured
    ? Math.min(promptConfig.temperature, 0.3)
    : promptConfig.temperature;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent?key=${apiKey}`;
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature,
      maxOutputTokens: Math.max(promptConfig.max_tokens, 4096),
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (enableStructured) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini ${response.status}: ${errorText.substring(0, 200)}`
    );
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const rawContent = parts
    .map((p: { text?: string }) =>
      typeof p?.text === "string" ? p.text : ""
    )
    .join("");
  const tokensUsed = data.usageMetadata?.totalTokenCount;
  const finishReason = data.candidates?.[0]?.finishReason;

  if (finishReason === "MAX_TOKENS" || (rawContent.length < 100 && enableStructured)) {
    console.warn(
      `[Gemini] Short or truncated response: rawLength=${rawContent.length}, finishReason=${finishReason ?? "unknown"}`
    );
  }

  return { rawContent, tokensUsed };
}

export function callAI(params: {
  provider: SmartDescriptionProvider;
  systemPrompt: string;
  userPrompt: string;
  promptConfig: PromptConfig;
  enableStructured: boolean;
}): Promise<{ rawContent: string; tokensUsed?: number }> {
  const { provider, ...rest } = params;
  return provider === "gemini" ? callGemini(rest) : callOpenAI(rest);
}

export function processAIResponse(params: {
  rawContent: string;
  mode: SmartDescriptionMode;
  enableStructured: boolean;
  serviceDisplayName: string;
  formattingRules: PromptConfig["formatting_rules"];
}): ProcessedAIResult {
  const {
    rawContent,
    mode,
    enableStructured,
    formattingRules,
  } = params;

  let structuredResponse: StructuredAIResponse | null = null;
  let processedDescription = "";

  if (mode === "suggestion") {
    processedDescription = postProcessDescription(
      rawContent,
      formattingRules
    );
    console.log(
      `[Mode: suggestion] ✅ Texto sugerido gerado: ${processedDescription.length} chars`
    );
    return { processedDescription, structuredResponse };
  }

  if (enableStructured) {
    try {
      const toParse = stripJsonCodeFence(rawContent);
      let parsed = JSON.parse(toParse) as Record<string, unknown>;
      parsed = unwrapNestedStructuredResponse(parsed);
      structuredResponse = validateStructuredResponse(parsed);

      if (structuredResponse) {
        processedDescription = formatProfessionalDescription(
          structuredResponse.professional_description
        );

        console.log(
          `[Structured] ✅ JSON validado: ${structuredResponse.tags.length} tags, ${structuredResponse.missing_info_warnings.length} warnings`
        );
      } else {
        console.warn("[Structured] ⚠️ JSON inválido, usando fallback");
        processedDescription = postProcessDescription(
          rawContent,
          formattingRules
        );
        structuredResponse = generateFallbackResponse(
          processedDescription,
        );
      }
    } catch (parseError) {
      console.warn("[Structured] ⚠️ Erro ao parsear JSON, usando fallback:", parseError);
      processedDescription = postProcessDescription(
        rawContent,
        formattingRules
      );
      structuredResponse = generateFallbackResponse(
        processedDescription,
      );
    }
    return { processedDescription, structuredResponse };
  }

  processedDescription = postProcessDescription(
    rawContent,
    formattingRules
  );
  console.log(
    `[Mode: full_description] ✅ Descrição gerada: ${processedDescription.length} chars`
  );
  return { processedDescription, structuredResponse: null };
}

export function buildSuccessResponse(
  params: {
    processedDescription: string;
    rawContent: string;
    promptConfig: PromptConfig;
    tokensUsed?: number;
    generationTime: number;
    mode: SmartDescriptionMode;
    enableStructured: boolean;
    structuredResponse: StructuredAIResponse | null;
    provider: SmartDescriptionProvider;
  },
  cors?: Record<string, string>
): Response {
  const {
    processedDescription,
    rawContent,
    promptConfig,
    tokensUsed,
    generationTime,
    mode,
    enableStructured,
    structuredResponse,
    provider,
  } = params;

  const responseData: {
    description: string;
    suggestedTitle?: string;
    metadata: Record<string, unknown>;
    structured?: StructuredAIResponse;
  } = {
    description: processedDescription,
    metadata: {
      prompt_key: promptConfig.prompt_key,
      prompt_version: promptConfig.version,
      tokens_used: tokensUsed,
      generation_time_ms: generationTime,
      raw_length: rawContent.length,
      processed_length: processedDescription.length,
      mode,
      structured: enableStructured && mode !== "suggestion",
      provider,
    },
  };

  if (structuredResponse && mode === "full_description") {
    responseData.suggestedTitle = structuredResponse.suggested_title;
    responseData.structured = structuredResponse;
  }

  return jsonResponse(responseData, 200, undefined, cors);
}

export function buildErrorResponse(
  errMessage: string,
  cors?: Record<string, string>
): Response {
  const fallback = generateFallbackResponse(
    `Erro ao gerar descrição: ${errMessage}`,
  );
  return jsonResponse(
    {
      error: errMessage,
      hint: "Verifique a configuração no painel admin ou tente novamente",
      description: fallback.professional_description,
      structured: fallback,
    },
    500,
    undefined,
    cors
  );
}

export async function logUsageOnError(
  supabase: SupabaseClient,
  promptConfig: PromptConfig,
  userId: string | null,
  generationTime: number,
  errMessage: string
): Promise<void> {
  await logPromptUsage(
    supabase,
    promptConfig.id,
    userId,
    null,
    false,
    undefined,
    generationTime,
    errMessage
  );
}
