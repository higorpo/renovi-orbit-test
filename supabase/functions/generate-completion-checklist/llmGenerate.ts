/** LLM call for checklist schema via Gemini — timeout ≪ enrichment lease (design §5.2 / Task 29). */

import { GEMINI_DEFAULT_MODEL, generateGeminiContent } from "../_shared/ai/index.ts";
import { classifyEnrichmentError } from "./classifyError.ts";
import { SYSTEM_PROMPT } from "./constants.ts";
import { formatContextForPrompt } from "./loadContext.ts";
import { resolveLlmTimeoutMs } from "./pacing.ts";
import { parseChecklistJson, validateChecklistSchema } from "./validateSchema.ts";
import type { LlmGenerateResult, ServiceRequestContext } from "./types.ts";

export type LlmGenerateDeps = {
  apiKey: string | undefined;
  fetchFn?: typeof fetch;
  model?: string;
  promptVersion?: string | null;
  timeoutMs?: number;
};

function failure(reason: string): LlmGenerateResult {
  const classified = classifyEnrichmentError(reason);
  return {
    ok: false,
    reason: classified.code,
    retryable: classified.retryable,
    errorClass: classified.class,
  };
}

export async function generateChecklistWithGemini(
  ctx: ServiceRequestContext,
  deps: LlmGenerateDeps,
): Promise<LlmGenerateResult> {
  if (!deps.apiKey) {
    return failure("GEMINI_API_KEY_MISSING");
  }

  const model = deps.model ??
    (Deno.env.get("GEMINI_CHECKLIST_MODEL")?.trim() || GEMINI_DEFAULT_MODEL);
  const promptVersion = deps.promptVersion ?? "completion-checklist-v1";
  const timeoutMs = deps.timeoutMs ?? resolveLlmTimeoutMs();
  const userPrompt = `Service request context:\n${formatContextForPrompt(ctx)}`;

  const result = await generateGeminiContent({
    apiKey: deps.apiKey,
    model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
    timeoutMs,
    fetchFn: deps.fetchFn,
  });

  if (!result.ok) {
    if (result.aborted) {
      return failure("LLM_TIMEOUT");
    }
    if (result.httpStatus != null) {
      return failure(`GEMINI_HTTP_${result.httpStatus}:${result.message}`);
    }
    if (result.message === "EMPTY_LLM_CONTENT") {
      return failure("EMPTY_LLM_CONTENT");
    }
    return failure(`LLM_ERROR:${result.message}`);
  }

  let parsed: unknown;
  try {
    parsed = parseChecklistJson(result.rawContent);
  } catch {
    return failure("LLM_JSON_PARSE");
  }

  const validated = validateChecklistSchema(parsed);
  if (!validated.ok) {
    return failure(`LLM_SCHEMA_${validated.reason}`);
  }

  return {
    ok: true,
    schema: validated.schema,
    model,
    promptVersion,
  };
}
