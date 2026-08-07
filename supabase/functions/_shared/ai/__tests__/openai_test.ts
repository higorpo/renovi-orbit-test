import { assertEquals } from "std/testing/asserts";
import { callOpenAIChatCompletions } from "../openai.ts";

Deno.test("callOpenAIChatCompletions returns content and tokens on success", async () => {
  const result = await callOpenAIChatCompletions({
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.3,
    maxTokens: 100,
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { total_tokens: 17 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.rawContent, '{"ok":true}');
    assertEquals(result.tokensUsed, 17);
  }
});

Deno.test("callOpenAIChatCompletions returns httpStatus on HTTP error", async () => {
  const result = await callOpenAIChatCompletions({
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    systemPrompt: "sys",
    userPrompt: "user",
    temperature: 0.3,
    maxTokens: 100,
    fetchFn: () =>
      Promise.resolve(
        new Response("invalid_api_key", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 401);
    assertEquals(result.message, "invalid_api_key");
  }
});
