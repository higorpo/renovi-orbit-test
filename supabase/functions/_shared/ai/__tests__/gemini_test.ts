import { assertEquals } from "std/testing/asserts";
import { generateGeminiContent } from "../gemini.ts";

Deno.test("generateGeminiContent joins candidate parts on success", async () => {
  const result = await generateGeminiContent({
    apiKey: "test-key",
    model: "gemini-2.5-flash-lite",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.2,
    maxOutputTokens: 1024,
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"a":' }, { text: "1}" }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { totalTokenCount: 42 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.rawContent, '{"a":1}');
    assertEquals(result.tokensUsed, 42);
    assertEquals(result.finishReason, "STOP");
  }
});

Deno.test("generateGeminiContent returns httpStatus on HTTP error", async () => {
  const result = await generateGeminiContent({
    apiKey: "test-key",
    model: "gemini-2.5-flash-lite",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.2,
    maxOutputTokens: 1024,
    fetchFn: () =>
      Promise.resolve(
        new Response("quota exceeded", {
          status: 429,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 429);
    assertEquals(result.message, "quota exceeded");
  }
});

Deno.test("generateGeminiContent returns EMPTY_LLM_CONTENT when parts empty", async () => {
  const result = await generateGeminiContent({
    apiKey: "test-key",
    model: "gemini-2.5-flash-lite",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.2,
    maxOutputTokens: 1024,
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [] }, finishReason: "STOP" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.message, "EMPTY_LLM_CONTENT");
  }
});

Deno.test("generateGeminiContent sets aborted on abort error", async () => {
  const result = await generateGeminiContent({
    apiKey: "test-key",
    model: "gemini-2.5-flash-lite",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.2,
    maxOutputTokens: 1024,
    fetchFn: () => Promise.reject(new Error("The operation was aborted")),
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.aborted, true);
  }
});

Deno.test("generateGeminiContent includes responseMimeType in request body", async () => {
  let capturedBody: string | null = null;

  await generateGeminiContent({
    apiKey: "test-key",
    model: "gemini-2.5-flash-lite",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.2,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    fetchFn: (_input, init) => {
      capturedBody = typeof init?.body === "string" ? init.body : null;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: "{}" }] }, finishReason: "STOP" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    },
  });

  assertEquals(capturedBody !== null, true);
  const parsed = JSON.parse(capturedBody!) as {
    generationConfig: { responseMimeType?: string; thinkingConfig?: unknown };
  };
  assertEquals(parsed.generationConfig.responseMimeType, "application/json");
  assertEquals(
    (parsed.generationConfig.thinkingConfig as { thinkingBudget: number })
      .thinkingBudget,
    0,
  );
});
