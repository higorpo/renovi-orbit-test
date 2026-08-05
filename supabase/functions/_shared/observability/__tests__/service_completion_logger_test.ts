import { assertEquals } from "std/testing/asserts";
import {
  SERVICE_COMPLETION_LOG_EVENTS,
  buildServiceCompletionLogContext,
  createServiceCompletionLogger,
  outcomeFromProcessKind,
  sanitizeServiceCompletionLogContext,
  serviceCompletionSentryTags,
} from "../service-completion-logger.ts";

Deno.test("sanitizeServiceCompletionLogContext strips checklist free text and URLs", () => {
  const sanitized = sanitizeServiceCompletionLogContext({
    enrichment_id: "enr-1",
    label: "Did you finish the kitchen?",
    justification: "Client was not home",
    checklist_schema: { version: 1, blocks: [] },
    responses: { c1: { met: true, justification: "x" } },
    evidence_url: "https://xxx.supabase.co/storage/v1/object/sign/bucket/a?token=abc",
    signed_url: "https://example.com/upload?token=secret",
    nested: {
      description: "free text",
      url: "https://leak.example/path",
      ok: true,
    },
    safe_code: "LLM_TIMEOUT",
  });

  assertEquals(sanitized.enrichment_id, "enr-1");
  assertEquals(sanitized.safe_code, "LLM_TIMEOUT");
  assertEquals("label" in sanitized, false);
  assertEquals("justification" in sanitized, false);
  assertEquals("checklist_schema" in sanitized, false);
  assertEquals("responses" in sanitized, false);
  assertEquals("evidence_url" in sanitized, false);
  assertEquals("signed_url" in sanitized, false);
  assertEquals(
    (sanitized.nested as Record<string, unknown>).ok,
    true,
  );
  assertEquals("description" in (sanitized.nested as object), false);
  assertEquals("url" in (sanitized.nested as object), false);
});

Deno.test("sanitizeServiceCompletionLogContext redacts URL-like strings", () => {
  const sanitized = sanitizeServiceCompletionLogContext({
    note: "see https://example.com/evidence/1",
    plain: "LLM_TIMEOUT",
  });
  assertEquals(sanitized.note, "[redacted_url]");
  assertEquals(sanitized.plain, "LLM_TIMEOUT");
});

Deno.test("buildServiceCompletionLogContext sets forensic tags", () => {
  const context = buildServiceCompletionLogContext({
    service_request_id: "sr-1",
    enrichment_id: "enr-1",
    contracted_service_id: "cs-1",
    attempt_count: 2,
    lease_generation: 4,
    correlation_id: "corr-1",
    outcome: "ops_attention",
    error_code: "SR_CONTEXT_MISSING",
    justification: "should-strip",
    signed_url: "https://should.not/appear",
  });

  assertEquals(context.service_request_id, "sr-1");
  assertEquals(context.enrichment_id, "enr-1");
  assertEquals(context.contracted_service_id, "cs-1");
  assertEquals(context.attempt, 2);
  assertEquals(context.lease_generation, 4);
  assertEquals(context.correlation_id, "corr-1");
  assertEquals(context.outcome, "ops_attention");
  assertEquals(context.error_code, "SR_CONTEXT_MISSING");
  assertEquals("justification" in context, false);
  assertEquals("signed_url" in context, false);
});

Deno.test("serviceCompletionSentryTags sample fixture for enrichment ops_attention", () => {
  const tags = serviceCompletionSentryTags({
    service_request_id: "sr-1",
    enrichment_id: "enr-1",
    attempt: 3,
    lease_generation: 2,
    correlation_id: "corr-ops",
    outcome: "ops_attention",
    error_code: "NO_FALLBACK_LLM_TIMEOUT",
  });

  assertEquals(tags.feature, "service_completion");
  assertEquals(tags.outcome, "ops_attention");
  assertEquals(tags.enrichment_id, "enr-1");
  assertEquals(tags.attempt, 3);
  assertEquals(tags.lease_generation, 2);
  assertEquals(tags.correlation_id, "corr-ops");
});

Deno.test("outcomeFromProcessKind maps worker outcomes to Sentry classes", () => {
  assertEquals(outcomeFromProcessKind("ready_fallback"), "fallback");
  assertEquals(outcomeFromProcessKind("retry_scheduled"), "transient_llm");
  assertEquals(outcomeFromProcessKind("ops_attention"), "ops_attention");
  assertEquals(outcomeFromProcessKind("ready_ai"), "ready_ai");
});

Deno.test("sample log fixtures distinguish mark_executed / confirm / auto_complete", () => {
  const mark = buildServiceCompletionLogContext({
    contracted_service_id: "cs-1",
    outcome: "mark_executed",
    error_code: "INVALID_CHECKLIST_RESPONSES",
  });
  const confirm = buildServiceCompletionLogContext({
    contracted_service_id: "cs-1",
    outcome: "confirm",
    error_code: "MISSING_RATING_SCORES",
  });
  const auto = buildServiceCompletionLogContext({
    contracted_service_id: "cs-2",
    outcome: "auto_complete",
    error_code: "row_error",
  });

  assertEquals(mark.outcome, "mark_executed");
  assertEquals(confirm.outcome, "confirm");
  assertEquals(auto.outcome, "auto_complete");
  assertEquals(
    SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_ROW_ERROR,
    "enrichment_row_error",
  );
});

Deno.test("createServiceCompletionLogger exposes leveled writers", () => {
  const logger = createServiceCompletionLogger("service-completion-test");
  logger.debug("dbg", { enrichment_id: "e1" });
  logger.info("inf", { outcome: "ready_ai" });
  logger.warn("wrn", { outcome: "validation" });
  logger.error("err", { outcome: "ops_attention" });
  assertEquals(typeof logger.info, "function");
});
