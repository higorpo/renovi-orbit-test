import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleGenerateCompletionChecklistRequest } from "../handleRequest.ts";
import type {
  GenerateCompletionChecklistDeps,
  ClaimedEnrichmentRow,
} from "../types.ts";

function stubRow(i: number): ClaimedEnrichmentRow {
  return {
    id: `enr-${i}`,
    service_request_id: `sr-${i}`,
    attempt_count: 0,
    lease_owner: "worker:auth-test",
    lease_generation: 1,
    locked_until: "2099-01-01T00:00:00Z",
    correlation_id: null,
  };
}

function deps(
  overrides: Partial<GenerateCompletionChecklistDeps> = {},
): GenerateCompletionChecklistDeps {
  return {
    batchSize: 20,
    createLeaseOwner: () => "worker:auth-test",
    claimBatch: async () => [] as ClaimedEnrichmentRow[],
    loadContext: async () => null,
    generateChecklist: async () => ({
      ok: false,
      reason: "unused",
      retryable: false,
      errorClass: "fatal",
    }),
    validateSchema: () => ({ ok: false, reason: "unused" }),
    finalizeReady: async () => ({ ok: false, code: "unused" }),
    scheduleRetry: async () => ({ ok: false, code: "unused" }),
    resolveFallbackTemplate: async () => null,
    markOpsAttention: async () => ({ ok: true }),
    getMaxAttempts: async () => 3,
    getClaimBatchSizeDefault: async () => 20,
    getLeaseTtlSeconds: async () => 120,
    ...overrides,
  };
}

function cronRequest(body: unknown = {}) {
  return new Request("http://local/generate-completion-checklist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Orbit-Cron-Secret": "test-cron-secret",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("handleGenerateCompletionChecklistRequest rejects missing cron auth", async () => {
  const res = await handleGenerateCompletionChecklistRequest(
    new Request("http://local/generate-completion-checklist", { method: "POST" }),
    deps(),
  );
  assertEquals(res.status, 401);
});

Deno.test("handleGenerateCompletionChecklistRequest accepts orbit cron secret", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "test-cron-secret");
  const res = await handleGenerateCompletionChecklistRequest(
    cronRequest({}),
    deps(),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.claimed, 0);
  assertEquals(body.lease_ttl_seconds, 120);
});

Deno.test("handleGenerateCompletionChecklistRequest claim→validate→finalize AI", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "test-cron-secret");
  const schema = {
    version: 1,
    blocks: [
      {
        id: "a",
        type: "completion_criterion",
        label: "A?",
        required: true,
        config: { requires_evidence_when_met: false, evidence_min: 1, evidence_max: 5 },
      },
      {
        id: "b",
        type: "completion_criterion",
        label: "B?",
        required: true,
        config: { requires_evidence_when_met: false, evidence_min: 1, evidence_max: 5 },
      },
      {
        id: "c",
        type: "completion_criterion",
        label: "C?",
        required: true,
        config: { requires_evidence_when_met: false, evidence_min: 1, evidence_max: 5 },
      },
    ],
  };

  const res = await handleGenerateCompletionChecklistRequest(
    cronRequest({}),
    deps({
      claimBatch: async () => [stubRow(0)],
      loadContext: async () => ({
        service_request_id: "sr-0",
        service_id: "svc-1",
        category_id: null,
        title: "t",
        description: "d",
        form_data: {},
        truncated: false,
      }),
      generateChecklist: async () => ({
        ok: true,
        schema,
        model: "gpt-mock",
        promptVersion: "v1",
      }),
      validateSchema: (s) => ({ ok: true as const, schema: s as typeof schema }),
      finalizeReady: async () => ({ ok: true }),
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.claimed, 1);
  assertEquals(body.ready_ai, 1);
  assertEquals(body.ready_fallback ?? 0, 0);
});

Deno.test("Task 64: large PENDING backlog claims ≤ paced batch (platform 20 → LLM cap 1)", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "test-cron-secret");
  Deno.env.delete("ENRICHMENT_MAX_LLM_PER_INVOCATION");
  Deno.env.delete("ENRICHMENT_LLM_TIMEOUT_MS");

  let requestedClaimSize = -1;
  const backlog = 100;

  const res = await handleGenerateCompletionChecklistRequest(
    cronRequest({ batch_size: 20 }),
    deps({
      claimBatch: async (_owner, size) => {
        requestedClaimSize = size;
        const n = Math.min(size, backlog);
        return Array.from({ length: n }, (_, i) => stubRow(i));
      },
      // Row processing no-ops via null context → ops_attention or similar; keep cheap
      loadContext: async () => null,
      markOpsAttention: async () => ({ ok: true }),
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(requestedClaimSize, 1);
  assertEquals(body.claimed, 1);
  assertEquals(body.requested_batch_size, 20);
  assertEquals(body.max_llm_per_invocation, 1);
});
