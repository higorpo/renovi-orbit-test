import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processCheckoutItemsSequential,
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import { createWorkerWallClockBudget } from "../workerBudget.ts";
import type { CheckoutDispatchDto } from "../types.ts";

function emailItem(overrides: Partial<CheckoutDispatchDto> = {}): CheckoutDispatchDto {
  return {
    id: "dispatch-edge",
    profile_id: "550e8400-e29b-41d4-a716-446655440001",
    channel: "email",
    template_key: "welcome_template",
    template_variables: { name: "Test" },
    correlation_id: "corr-edge",
    status: "PROCESSING",
    locked_until: "2026-01-01T00:00:00Z",
    locked_by: "worker-edge",
    recipient_email: "user@example.com",
    deliveries: [],
    ...overrides,
  };
}

function pushItem(overrides: Partial<CheckoutDispatchDto> = {}): CheckoutDispatchDto {
  return {
    id: "dispatch-push-edge",
    profile_id: "550e8400-e29b-41d4-a716-446655440001",
    channel: "push",
    template_key: "engagement_push",
    template_variables: { name: "Test", headline: "Hi", body: "Body" },
    correlation_id: "corr-push-edge",
    status: "PROCESSING",
    locked_until: "2026-01-01T00:00:00Z",
    locked_by: "worker-edge",
    recipient_email: null,
    deliveries: [{
      delivery_id: "del-1",
      device_id: "device-1",
      fcm_token_snapshot: "token-1",
    }],
    ...overrides,
  };
}

function baseDeps(overrides: Partial<ProcessDispatchDeps> = {}): ProcessDispatchDeps {
  return {
    fetchEmailTemplate: async () => ({
      channel: "email" as const,
      template_key: "welcome_template",
      active: true,
      subject_template: "Hi {{name}}",
      body_template: "<p>{{name}}</p>",
      json_schema: {},
    }),
    fetchPushTemplate: async () => ({
      channel: "push" as const,
      template_key: "engagement_push",
      active: true,
      subject_template: "{{headline}}",
      body_template: "{{body}}",
      variable_schema: {
        type: "object",
        properties: { name: { type: "string" }, headline: { type: "string" }, body: { type: "string" } },
        required: ["name", "headline", "body"],
      },
    }),
    renderEmailFromTemplate: (template) => ({
      subject: template.subject_template ?? "",
      html: template.body_template,
    }),
    validateAndRenderPush: (template) => ({
      title: template.subject_template ?? "",
      body: template.body_template,
    }),
    sendResendEmail: async () => ({
      ok: true,
      vendorMessageId: "re_mock",
      httpStatus: 200,
    }),
    sendFcmPush: async () => ({
      ok: true,
      vendorMessageId: "fcm_mock",
      httpStatus: 200,
    }),
    reportDeliveryOutcome: async () => ({ applied: true, status: "DELIVERED" }),
    ...overrides,
  };
}

// --- Missing recipient_email ---

Deno.test("processDispatch email: reports terminal failure when recipient_email is null", async () => {
  const reportCalls: Array<{ dispatchId: string; errorCode?: string | null }> = [];
  const deps = baseDeps({
    reportDeliveryOutcome: async (_supabase, input) => {
      reportCalls.push({ dispatchId: input.dispatchId, errorCode: input.errorCode });
      return { applied: true, status: "FAILED_TERMINAL" };
    },
  });
  const item = emailItem({ recipient_email: null });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    item,
    "worker-1",
    deps,
  );
  assertEquals(counts.sendFailed, 1);
  assertEquals(counts.renderFailed, 0);
  assertEquals(counts.sendSucceeded, 0);
  assertEquals(reportCalls.length, 1);
  assertEquals(reportCalls[0].errorCode, "missing_recipient_email");
});

Deno.test("processDispatch email: reports terminal failure when recipient_email is empty", async () => {
  const reportCalls: Array<{ dispatchId: string }> = [];
  const deps = baseDeps({
    reportDeliveryOutcome: async (_supabase, input) => {
      reportCalls.push({ dispatchId: input.dispatchId });
      return { applied: true, status: "FAILED_TERMINAL" };
    },
  });
  const item = emailItem({ recipient_email: "   " });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    item,
    "worker-1",
    deps,
  );
  assertEquals(counts.sendFailed, 1);
  assertEquals(reportCalls.length, 1);
});

// --- Unknown channel ---

Deno.test("processDispatch: unknown channel returns zero counts", async () => {
  const item = emailItem({ channel: "sms" as "email" });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    item,
    "worker-1",
    baseDeps(),
  );
  assertEquals(counts.renderFailed, 0);
  assertEquals(counts.sendSucceeded, 0);
  assertEquals(counts.sendFailed, 0);
});

// --- Template render error ---

Deno.test("processDispatch email: template fetch error counts as renderFailed", async () => {
  const deps = baseDeps({
    fetchEmailTemplate: async () => {
      throw new Error("template_not_found: missing");
    },
  });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    emailItem(),
    "worker-1",
    deps,
  );
  assertEquals(counts.renderFailed, 1);
  assertEquals(counts.sendSucceeded, 0);
});

Deno.test("processDispatch push: template fetch error counts as renderFailed", async () => {
  const deps = baseDeps({
    fetchPushTemplate: async () => {
      throw new Error("template_not_found: missing_push");
    },
  });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    pushItem(),
    "worker-1",
    deps,
  );
  assertEquals(counts.renderFailed, 1);
});

// --- Push with no deliveries ---

Deno.test("processDispatch push: empty deliveries array reports sendFailed", async () => {
  const item = pushItem({ deliveries: [] });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    item,
    "worker-1",
    baseDeps(),
  );
  assertEquals(counts.sendFailed, 1);
  assertEquals(counts.sendSucceeded, 0);
});

// --- Report not applied ---

Deno.test("processDispatch email: sendFailed when report not applied", async () => {
  const deps = baseDeps({
    reportDeliveryOutcome: async () => ({
      applied: false,
      status: "PROCESSING",
      reason: "stale_worker",
    }),
  });
  const counts = await processDispatchItem(
    {} as SupabaseClient,
    emailItem(),
    "worker-1",
    deps,
  );
  assertEquals(counts.sendFailed, 1);
  assertEquals(counts.sendSucceeded, 0);
});

// --- Wall clock budget exceeded ---

Deno.test("processCheckoutItemsSequential skips items when budget exceeded", async () => {
  const budget = createWorkerWallClockBudget(1);
  budget.startedAt = performance.now() - 10;

  const items = [emailItem({ id: "d-1" }), emailItem({ id: "d-2" }), emailItem({ id: "d-3" })];
  const result = await processCheckoutItemsSequential(
    {} as SupabaseClient,
    items,
    "worker-budget",
    baseDeps(),
    budget,
  );

  assertEquals(result.processed, 0);
  assertEquals(result.skipped, 3);
  assertEquals(result.budget_exceeded, true);
});

Deno.test("processCheckoutItemsSequential processes all items within budget", async () => {
  const budget = createWorkerWallClockBudget(60_000);
  const items = [emailItem({ id: "d-1" }), emailItem({ id: "d-2" })];
  const result = await processCheckoutItemsSequential(
    {} as SupabaseClient,
    items,
    "worker-ok",
    baseDeps(),
    budget,
  );

  assertEquals(result.processed, 2);
  assertEquals(result.succeeded, 2);
  assertEquals(result.skipped, 0);
  assertEquals(result.budget_exceeded, false);
});

// --- Empty batch ---

Deno.test("processCheckoutItemsSequential handles empty batch gracefully", async () => {
  const result = await processCheckoutItemsSequential(
    {} as SupabaseClient,
    [],
    "worker-empty",
    baseDeps(),
  );

  assertEquals(result.processed, 0);
  assertEquals(result.succeeded, 0);
  assertEquals(result.failed, 0);
  assertEquals(result.skipped, 0);
});
