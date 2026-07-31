import { assertEquals } from "std/testing/asserts";
import { PAYOUT_INLINE_MAX_MOVEMENTS } from "../parsePayoutPayload.ts";
import {
  isHeavyPathEventType,
  isIgnorableIngressEvent,
  shouldEnqueueAfterProcess,
} from "../webhookRouting.ts";

Deno.test("isHeavyPathEventType matches TRANSACTION_UPDATE", () => {
  assertEquals(isHeavyPathEventType("TRANSACTION_UPDATE"), true);
  assertEquals(isHeavyPathEventType("TRANSACTION_CAPTURE"), false);
  assertEquals(isHeavyPathEventType("WEBHOOK_PING"), false);
});

Deno.test("isHeavyPathEventType queues large PAYOUT batches only", () => {
  assertEquals(
    isHeavyPathEventType("PAYOUT_CREATE", {
      movements: Array.from({ length: PAYOUT_INLINE_MAX_MOVEMENTS }, (_, i) => ({
        id: i,
      })),
    }),
    false,
  );
  assertEquals(
    isHeavyPathEventType("PAYOUT_SETTLE", {
      movements: Array.from(
        { length: PAYOUT_INLINE_MAX_MOVEMENTS + 1 },
        (_, i) => ({ id: i }),
      ),
    }),
    true,
  );
  assertEquals(
    isHeavyPathEventType("PAYOUT_CREATE", { movements: [] }),
    false,
  );
  assertEquals(isHeavyPathEventType("PAYOUT_CREATE"), false);
});

Deno.test("isIgnorableIngressEvent matches WEBHOOK_PING", () => {
  assertEquals(isIgnorableIngressEvent("WEBHOOK_PING"), true);
  assertEquals(isIgnorableIngressEvent("TRANSACTION_CAPTURE"), false);
});

Deno.test("shouldEnqueueAfterProcess enqueues on retry_scheduled", () => {
  assertEquals(
    shouldEnqueueAfterProcess({ outcome: "retry_scheduled" }),
    true,
  );
});

Deno.test("shouldEnqueueAfterProcess enqueues on handler skipped or not_found", () => {
  assertEquals(
    shouldEnqueueAfterProcess({
      outcome: "processed",
      handler: { outcome: "skipped" },
    }),
    true,
  );
  assertEquals(
    shouldEnqueueAfterProcess({
      outcome: "processed",
      handler: { outcome: "not_found" },
    }),
    true,
  );
  assertEquals(
    shouldEnqueueAfterProcess({
      outcome: "processed",
      handler: { outcome: "upserted" },
    }),
    false,
  );
  assertEquals(
    shouldEnqueueAfterProcess({
      outcome: "processed",
      handler: { outcome: "noop" },
    }),
    false,
  );
});
