import { assertEquals, assertExists } from "std/testing/asserts";
import { buildLogEntry, createLogger, serializeLogEntry } from "../logger.ts";

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

Deno.test("buildLogEntry omits empty correlation_id", () => {
  const entry = buildLogEntry("debug", "test", "event", {
    correlation_id: "",
    ok: true,
  });
  assertEquals("correlation_id" in entry, false);
  assertEquals(entry.ok, true);
});

Deno.test("serializeLogEntry produces parseable JSON", () => {
  const entry = buildLogEntry("warn", "test", "event.name", { reason: "scaffold" });
  const parsed = JSON.parse(serializeLogEntry(entry)) as Record<string, unknown>;

  assertEquals(parsed.level, "warn");
  assertEquals(parsed.scope, "test");
  assertExists(parsed.timestamp);
});

Deno.test("createLogger exposes debug info warn and error writers", () => {
  const logger = createLogger("logger-test-scope");
  logger.debug("debug.event", { a: 1 });
  logger.info("info.event", { b: 2 });
  logger.warn("warn.event", { c: 3 });
  logger.error("error.event", { d: 4 });
  assertEquals(typeof logger.debug, "function");
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
});
