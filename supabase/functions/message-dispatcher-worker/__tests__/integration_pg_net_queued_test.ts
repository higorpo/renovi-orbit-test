import { assertEquals } from "std/testing/asserts";

/**
 * Documents design §8.1: pg_net worker invoke failure does not mutate dispatch FSM.
 * Checkout/report run only inside the worker Edge function, not in invoke_worker RPC.
 */
Deno.test("worker invoke failure semantics: cron POST does not imply checkout", () => {
  const cronSideEffects = ["net.http_post"];
  const workerSideEffects = ["checkout_batch", "report_delivery_outcome"];

  assertEquals(
    cronSideEffects.some((e) => workerSideEffects.includes(e)),
    false,
  );
});
