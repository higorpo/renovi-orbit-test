/** LLM call for checklist schema via Gemini — timeout ≪ enrichment lease (design §5.2 / Task 29). */

import { fetchWithTimeout } from "../_shared/providerHttp.ts";
import { GEMINI_DEFAULT_MODEL } from "../generate-smart-description/constants.ts";
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

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${deps.apiKey}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
      { timeoutMs, fetchFn: deps.fetchFn },
    );

    if (!response.ok) {
      const status = response.status;
      const snippet = (await response.text()).slice(0, 200);
      return failure(`GEMINI_HTTP_${status}:${snippet}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const content = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
    if (!content.trim()) {
      return failure("EMPTY_LLM_CONTENT");
    }

    let parsed: unknown;
    try {
      parsed = parseChecklistJson(content);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const aborted = /abort/i.test(message);
    return failure(
      aborted ? "LLM_TIMEOUT" : `LLM_ERROR:${message.slice(0, 200)}`,
    );
  }
}
