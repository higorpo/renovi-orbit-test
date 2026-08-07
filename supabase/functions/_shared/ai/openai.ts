import { fetchWithTimeout } from "../providerHttp.ts";

export type OpenAIChatCompletionsParams = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  jsonObject?: boolean;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export type OpenAIChatCompletionsResult =
  | { ok: true; rawContent: string; tokensUsed?: number }
  | { ok: false; message: string; httpStatus?: number; aborted?: boolean };

export async function callOpenAIChatCompletions(
  params: OpenAIChatCompletionsParams,
): Promise<OpenAIChatCompletionsResult> {
  const {
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
    jsonObject,
    timeoutMs,
    fetchFn,
  } = params;

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature,
          ...(jsonObject ? { response_format: { type: "json_object" } } : {}),
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

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const rawContent = data.choices?.[0]?.message?.content ?? "";

    return {
      ok: true,
      rawContent,
      tokensUsed: data.usage?.total_tokens,
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
