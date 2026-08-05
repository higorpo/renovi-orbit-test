import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { processClaimedRow } from "../processClaimedRow.ts";
import type {
  ClaimedEnrichmentRow,
  GenerateCompletionChecklistDeps,
  ChecklistSchema,
} from "../types.ts";

const schema: ChecklistSchema = {
  version: 1,
  blocks: [
    {
      id: "a",
      type: "completion_criterion",
      label: "A?",
      required: true,
      config: {
        requires_evidence_when_met: true,
        evidence_min: 1,
        evidence_max: 5,
      },
    },
    {
      id: "b",
      type: "completion_criterion",
      label: "B?",
      required: true,
      config: {
        requires_evidence_when_met: false,
        evidence_min: 1,
        evidence_max: 5,
      },
    },
    {
      id: "c",
      type: "completion_criterion",
      label: "C?",
      required: true,
      config: {
        requires_evidence_when_met: false,
        evidence_min: 1,
        evidence_max: 5,
      },
    },
  ],
};

function baseRow(overrides: Partial<ClaimedEnrichmentRow> = {}): ClaimedEnrichmentRow {
  return {
    id: "enr-1",
    service_request_id: "sr-1",
    attempt_count: 0,
    lease_owner: "worker:1",
    lease_generation: 1,
    locked_until: "2099-01-01T00:00:00Z",
    correlation_id: "corr-1",
    ...overrides,
  };
}

function baseDeps(
  overrides: Partial<GenerateCompletionChecklistDeps> = {},
): GenerateCompletionChecklistDeps {
  return {
    batchSize: 5,
    createLeaseOwner: () => "worker:test",
    claimBatch: async () => [],
    loadContext: async () => ({
      service_request_id: "sr-1",
      service_id: "svc-1",
      category_id: "cat-1",
      title: "t",
      description: "d",
      form_data: {},
      truncated: false,
    }),
    generateChecklist: async () => ({
      ok: true,
      schema,
      model: "gpt-test",
      promptVersion: "v1",
    }),
    validateSchema: (s) => ({ ok: true, schema: s as ChecklistSchema }),
    finalizeReady: async () => ({ ok: true }),
    scheduleRetry: async () => ({ ok: true, nextAttemptAt: "2099-01-01T00:00:00Z" }),
    resolveFallbackTemplate: async () => ({ templateId: "tpl-1", schema }),
    markOpsAttention: async () => ({ ok: true }),
    getMaxAttempts: async () => 3,
    getClaimBatchSizeDefault: async () => 20,
    getLeaseTtlSeconds: async () => 120,
    ...overrides,
  };
}

Deno.test("processClaimedRow finalizes AI success", async () => {
  const outcome = await processClaimedRow(baseRow(), baseDeps());
  assertEquals(outcome, { kind: "ready_ai" });
});

Deno.test("processClaimedRow schedules retry on transient LLM failure", async () => {
  const outcome = await processClaimedRow(
    baseRow(),
    baseDeps({
      generateChecklist: async () => ({
        ok: false,
        reason: "LLM_TIMEOUT",
        retryable: true,
      }),
    }),
  );
  assertEquals(outcome, { kind: "retry_scheduled" });
});

Deno.test("processClaimedRow uses fallback when attempts exhausted", async () => {
  const outcome = await processClaimedRow(
    baseRow({ attempt_count: 3 }),
    baseDeps({
      generateChecklist: async () => ({
        ok: false,
        reason: "LLM_TIMEOUT",
        retryable: true,
      }),
      getMaxAttempts: async () => 3,
    }),
  );
  assertEquals(outcome, { kind: "ready_fallback" });
});

Deno.test("processClaimedRow no-ops on stale lease finalize", async () => {
  const outcome = await processClaimedRow(
    baseRow(),
    baseDeps({
      finalizeReady: async () => ({ ok: false, code: "STALE_LEASE_OR_STATE" }),
    }),
  );
  assertEquals(outcome, { kind: "noop", reason: "STALE_LEASE_OR_STATE" });
});

Deno.test("processClaimedRow no-ops when SR aborted during finalize", async () => {
  const outcome = await processClaimedRow(
    baseRow(),
    baseDeps({
      finalizeReady: async () => ({ ok: false, code: "ABORTED" }),
    }),
  );
  assertEquals(outcome, { kind: "noop", reason: "ABORTED" });
});

Deno.test("processClaimedRow logs truncation path then finalizes AI", async () => {
  let sawTruncated = false;
  const outcome = await processClaimedRow(
    baseRow(),
    baseDeps({
      loadContext: async () => ({
        service_request_id: "sr-1",
        service_id: "svc-1",
        category_id: "cat-1",
        title: "t",
        description: "d",
        form_data: { _truncated: true },
        truncated: true,
        original_chars: 20_000,
        truncated_chars: 12_000,
      }),
      generateChecklist: async (ctx) => {
        sawTruncated = ctx.truncated === true;
        return {
          ok: true,
          schema,
          model: "gpt-test",
          promptVersion: "v1",
        };
      },
    }),
  );
  assertEquals(sawTruncated, true);
  assertEquals(outcome, { kind: "ready_ai" });
});

Deno.test("processClaimedRow marks ops_attention when no fallback", async () => {
  const outcome = await processClaimedRow(
    baseRow({ attempt_count: 3 }),
    baseDeps({
      generateChecklist: async () => ({
        ok: false,
        reason: "GEMINI_API_KEY_MISSING",
        retryable: false,
      }),
      resolveFallbackTemplate: async () => null,
    }),
  );
  assertEquals(outcome, { kind: "ops_attention" });
});

Deno.test("§8.1 invalid JSON/validation: retries while attempts remain", async () => {
  const outcome = await processClaimedRow(
    baseRow({ attempt_count: 0 }),
    baseDeps({
      generateChecklist: async () => ({
        ok: true,
        schema,
        model: "gpt-test",
        promptVersion: "v1",
      }),
      validateSchema: () => ({ ok: false, reason: "CARDINALITY" }),
      getMaxAttempts: async () => 3,
    }),
  );
  assertEquals(outcome, { kind: "retry_scheduled" });
});

Deno.test("§8.1 invalid JSON/validation exhausted: applies template fallback", async () => {
  const outcome = await processClaimedRow(
    baseRow({ attempt_count: 3 }),
    baseDeps({
      generateChecklist: async () => ({
        ok: true,
        schema,
        model: "gpt-test",
        promptVersion: "v1",
      }),
      validateSchema: () => ({ ok: false, reason: "ALLOWLIST" }),
      getMaxAttempts: async () => 3,
    }),
  );
  assertEquals(outcome, { kind: "ready_fallback" });
});

Deno.test("§8.1 template missing after max attempts: ops_attention hold", async () => {
  const outcome = await processClaimedRow(
    baseRow({ attempt_count: 3 }),
    baseDeps({
      generateChecklist: async () => ({
        ok: false,
        reason: "LLM_TIMEOUT",
        retryable: true,
      }),
      resolveFallbackTemplate: async () => null,
      getMaxAttempts: async () => 3,
    }),
  );
  assertEquals(outcome, { kind: "ops_attention" });
});

Deno.test("processClaimedRow passes correlation_id when context missing", async () => {
  let seenCorrelation: string | null | undefined;
  const outcome = await processClaimedRow(
    baseRow({ correlation_id: "corr-missing-ctx" }),
    baseDeps({
      loadContext: async () => null,
      markOpsAttention: async (input) => {
        seenCorrelation = input.correlationId;
        return { ok: true };
      },
    }),
  );
  assertEquals(outcome, { kind: "ops_attention" });
  assertEquals(seenCorrelation, "corr-missing-ctx");
});
