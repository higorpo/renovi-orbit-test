import { assertEquals, assertExists } from "std/testing/asserts";
import { buildLogEntry, serializeLogEntry } from "../logger.ts";

Deno.test("buildLogEntry attaches scope and correlation_id", () => {
  const entry = buildLogEntry("info", "message-dispatcher-worker", "worker.scaffold", {
    correlation_id: "550e8400-e29b-41d4-a716-446655440000",
    processed: 0,
  });

  assertEquals(entry.scope, "message-dispatcher-worker");
  assertEquals(entry.event, "worker.scaffold");
  assertEquals(entry.correlation_id, "550e8400-e29b-41d4-a716-446655440000");
  assertEquals(entry.processed, 0);
});

Deno.test("serializeLogEntry produces parseable JSON", () => {
  const entry = buildLogEntry("warn", "test", "event.name", { reason: "scaffold" });
  const parsed = JSON.parse(serializeLogEntry(entry)) as Record<string, unknown>;

  assertEquals(parsed.level, "warn");
  assertEquals(parsed.scope, "test");
  assertExists(parsed.timestamp);
});
