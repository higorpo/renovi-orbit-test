import { fetchWithTimeout } from "../providerHttp.ts";

export type GeminiGenerateContentParams = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseMimeType?: "application/json";
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export type GeminiGenerateContentResult =
  | { ok: true; rawContent: string; tokensUsed?: number; finishReason?: string }
  | { ok: false; message: string; httpStatus?: number; aborted?: boolean };

export async function generateGeminiContent(
  params: GeminiGenerateContentParams,
): Promise<GeminiGenerateContentResult> {
  const {
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxOutputTokens,
    responseMimeType,
    timeoutMs,
    fetchFn,
  } = params;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }

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
            parts: [{ text: systemPrompt }],
          },
          generationConfig,
        }),
      },
      { timeoutMs, fetchFn },
    );

    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 200);
      return {
        ok: false,
        message: snippet,
        httpStatus: response.status,
      };
    }

    const payload = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { totalTokenCount?: number };
    };

    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const rawContent = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("");

    if (!rawContent.trim()) {
      return { ok: false, message: "EMPTY_LLM_CONTENT" };
    }

    return {
      ok: true,
      rawContent,
      tokensUsed: payload.usageMetadata?.totalTokenCount,
      finishReason: payload.candidates?.[0]?.finishReason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const aborted = /abort/i.test(message);
    return {
      ok: false,
      message: message.slice(0, 200),
      aborted,
    };
  }
}
