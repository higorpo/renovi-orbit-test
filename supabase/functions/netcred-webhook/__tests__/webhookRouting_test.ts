import { assertEquals } from "std/testing/asserts";
import {
  isHeavyPathEventType,
  isIgnorableIngressEvent,
  shouldEnqueueAfterProcess,
} from "../webhookRouting.ts";

Deno.test("isHeavyPathEventType only matches TRANSACTION_UPDATE", () => {
  assertEquals(isHeavyPathEventType("TRANSACTION_UPDATE"), true);
  assertEquals(isHeavyPathEventType("TRANSACTION_CAPTURE"), false);
  assertEquals(isHeavyPathEventType("WEBHOOK_PING"), false);
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
      handler: { outcome: "applied" },
    }),
    false,
  );
});
