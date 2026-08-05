import { assertEquals } from "std/testing/asserts";
import { classifyEnrichmentError } from "../classifyError.ts";

Deno.test("classifyEnrichmentError marks LLM_TIMEOUT transient", () => {
  const result = classifyEnrichmentError("LLM_TIMEOUT");
  assertEquals(result, {
    class: "transient",
    retryable: true,
    code: "LLM_TIMEOUT",
  });
});

Deno.test("classifyEnrichmentError marks schema failures validation", () => {
  const result = classifyEnrichmentError("LLM_SCHEMA_criterion_cardinality");
  assertEquals(result.class, "validation");
  assertEquals(result.retryable, true);
});

Deno.test("classifyEnrichmentError marks missing API key fatal", () => {
  const result = classifyEnrichmentError("GEMINI_API_KEY_MISSING");
  assertEquals(result.class, "fatal");
  assertEquals(result.retryable, false);
});

Deno.test("classifyEnrichmentError marks Gemini 429 transient and 400 fatal", () => {
  assertEquals(classifyEnrichmentError("GEMINI_HTTP_429:rate").class, "transient");
  assertEquals(classifyEnrichmentError("GEMINI_HTTP_400:bad").class, "fatal");
  assertEquals(classifyEnrichmentError("GEMINI_HTTP_400:bad").retryable, false);
});
