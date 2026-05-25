import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processCheckoutItemsSequential,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import { createWorkerWallClockBudget } from "../workerBudget.ts";
import type { CheckoutDispatchDto, WorkerRunResult } from "../types.ts";
import { checkoutBatch } from "../checkout.ts";

function emailItem(id: string): CheckoutDispatchDto {
  return {
    id,
    profile_id: "550e8400-e29b-41d4-a716-446655440001",
    channel: "email",
    template_key: "welcome_template",
    template_variables: { name: "Test" },
    correlation_id: `corr-${id}`,
    status: "PROCESSING",
    locked_until: "2026-01-01T00:00:00Z",
    locked_by: "worker-loop",
    recipient_email: "user@example.com",
    deliveries: [],
  };
}

function fastDeps(): ProcessDispatchDeps {
  return {
    fetchEmailTemplate: async () => ({
      channel: "email" as const,
      template_key: "welcome_template",
      active: true,
      subject_template: "Hi {{name}}",
      body_template: "<p>{{name}}</p>",
      json_schema: {},
    }),
    fetchPushTemplate: async () => {
      throw new Error("unexpected");
    },
    renderEmailFromTemplate: (template) => ({
      subject: template.subject_template ?? "",
      html: template.body_template,
    }),
    validateAndRenderPush: () => {
      throw new Error("unexpected");
    },
    sendResendEmail: async () => ({
      ok: true,
      vendorMessageId: "re_mock",
      httpStatus: 200,
    }),
    sendFcmPush: async () => {
      throw new Error("unexpected");
    },
    reportDeliveryOutcome: async () => ({ applied: true, status: "DELIVERED" }),
  };
}

/**
 * Simulates the re-checkout loop from index.ts in a testable way,
 * using a mock checkout function instead of SupabaseClient.
 */
async function simulateRecheckoutLoop(
  batchesOfItems: CheckoutDispatchDto[][],
  budgetMs: number,
): Promise<WorkerRunResult> {
  const budget = createWorkerWallClockBudget(budgetMs);
  const deps = fastDeps();
  const workerId = "worker-loop-test";
  let batchIndex = 0;

  const totals: WorkerRunResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    batches: 0,
    budget_exceeded: false,
  };

  while (budget.startedAt + budget.budgetMs > performance.now()) {
    const items = batchIndex < batchesOfItems.length
      ? batchesOfItems[batchIndex]
      : [];
    batchIndex++;

    if (items.length === 0) break;

    const batchResult = await processCheckoutItemsSequential(
      {} as SupabaseClient,
      items,
      workerId,
      deps,
      budget,
    );

    totals.batches! += 1;
    totals.processed += batchResult.processed;
    totals.succeeded += batchResult.succeeded;
    totals.failed += batchResult.failed;
    totals.skipped! += batchResult.skipped;

    if (batchResult.budget_exceeded) {
      totals.budget_exceeded = true;
      break;
    }
  }

  return totals;
}

Deno.test("re-checkout loop processes multiple batches within budget", async () => {
  const batch1 = [emailItem("d-1"), emailItem("d-2")];
  const batch2 = [emailItem("d-3"), emailItem("d-4")];
  const batch3 = [emailItem("d-5")];

  const result = await simulateRecheckoutLoop(
    [batch1, batch2, batch3],
    60_000,
  );

  assertEquals(result.batches, 3);
  assertEquals(result.processed, 5);
  assertEquals(result.succeeded, 5);
  assertEquals(result.budget_exceeded, false);
});

Deno.test("re-checkout loop stops when queue is empty", async () => {
  const batch1 = [emailItem("d-1")];

  const result = await simulateRecheckoutLoop(
    [batch1],
    60_000,
  );

  assertEquals(result.batches, 1);
  assertEquals(result.processed, 1);
  assertEquals(result.succeeded, 1);
  assertEquals(result.budget_exceeded, false);
});

Deno.test("re-checkout loop stops when budget is exceeded", async () => {
  const budget = createWorkerWallClockBudget(1);
  budget.startedAt = performance.now() - 10;

  const items = [emailItem("d-1"), emailItem("d-2")];
  const batchResult = await processCheckoutItemsSequential(
    {} as SupabaseClient,
    items,
    "worker-budget-loop",
    fastDeps(),
    budget,
  );

  assertEquals(batchResult.processed, 0);
  assertEquals(batchResult.skipped, 2);
  assertEquals(batchResult.budget_exceeded, true);
});

Deno.test("re-checkout loop accumulates counts across batches", async () => {
  const batch1 = [emailItem("d-1"), emailItem("d-2"), emailItem("d-3")];
  const batch2 = [emailItem("d-4"), emailItem("d-5")];

  const result = await simulateRecheckoutLoop(
    [batch1, batch2],
    60_000,
  );

  assertEquals(result.batches, 2);
  assertEquals(result.processed, 5);
  assertEquals(result.succeeded, 5);
  assertEquals(result.failed, 0);
  assertEquals(result.skipped, 0);
});
