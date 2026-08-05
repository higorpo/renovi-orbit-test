import { assertEquals } from "std/testing/asserts";
import { generateChecklistWithGemini } from "../llmGenerate.ts";
import type { ServiceRequestContext } from "../types.ts";

const ctx: ServiceRequestContext = {
  service_request_id: "sr-1",
  service_id: "svc-1",
  category_id: null,
  title: "Teste",
  description: "desc",
  form_data: {},
  truncated: false,
};

Deno.test("generateChecklistWithGemini classifies abort as LLM_TIMEOUT transient", async () => {
  const result = await generateChecklistWithGemini(ctx, {
    apiKey: "gemini-test",
    timeoutMs: 10,
    fetchFn: () => {
      const err = new Error("The operation was aborted");
      return Promise.reject(err);
    },
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason, "LLM_TIMEOUT");
    assertEquals(result.retryable, true);
    assertEquals(result.errorClass, "transient");
  }
});

Deno.test("generateChecklistWithGemini classifies missing key as fatal", async () => {
  const result = await generateChecklistWithGemini(ctx, {
    apiKey: undefined,
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason, "GEMINI_API_KEY_MISSING");
    assertEquals(result.errorClass, "fatal");
    assertEquals(result.retryable, false);
  }
});

Deno.test("generateChecklistWithGemini parses Gemini JSON response", async () => {
  const schema = {
    version: 1,
    blocks: [
      {
        id: "crit_done",
        type: "completion_criterion",
        label: "Serviço concluído?",
        required: true,
        config: {
          requires_evidence_when_met: true,
          evidence_min: 1,
          evidence_max: 3,
        },
      },
      {
        id: "crit_clean",
        type: "completion_criterion",
        label: "Área limpa?",
        required: true,
        config: { requires_evidence_when_met: false, evidence_min: 1, evidence_max: 1 },
      },
      {
        id: "crit_access",
        type: "completion_criterion",
        label: "Acesso liberado?",
        required: true,
        config: { requires_evidence_when_met: false, evidence_min: 1, evidence_max: 1 },
      },
    ],
  };

  const result = await generateChecklistWithGemini(ctx, {
    apiKey: "gemini-test",
    model: "gemini-2.5-flash-lite",
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(schema) }] },
                finishReason: "STOP",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.model, "gemini-2.5-flash-lite");
    assertEquals(result.schema.version, 1);
  }
});
