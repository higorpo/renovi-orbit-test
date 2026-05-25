import { assert, assertEquals } from "std/testing/asserts";
import {
  DEFAULT_CHECKOUT_LIMIT,
  MAX_CHECKOUT_LIMIT,
  WORKER_WALL_CLOCK_BUDGET_MS,
  WORKER_WALL_CLOCK_HARD_LIMIT_MS,
} from "../constants.ts";
import {
  createWorkerWallClockBudget,
  isWorkerWallClockExceeded,
} from "../workerBudget.ts";
import { clampCheckoutLimit } from "../checkout.ts";

Deno.test("batch limits: default 50 max 50 (design §5.5)", () => {
  assertEquals(DEFAULT_CHECKOUT_LIMIT, 50);
  assertEquals(MAX_CHECKOUT_LIMIT, 50);
  assertEquals(clampCheckoutLimit(50), 50);
});

Deno.test("wall clock budget targets 60s p95 with 120s hard ceiling", () => {
  assertEquals(WORKER_WALL_CLOCK_BUDGET_MS, 60_000);
  assertEquals(WORKER_WALL_CLOCK_HARD_LIMIT_MS, 120_000);
  assert(WORKER_WALL_CLOCK_BUDGET_MS < WORKER_WALL_CLOCK_HARD_LIMIT_MS);
});

Deno.test("isWorkerWallClockExceeded respects custom budget", () => {
  const budget = createWorkerWallClockBudget(10);
  budget.startedAt = performance.now() - 15;
  assertEquals(isWorkerWallClockExceeded(budget), true);
});
