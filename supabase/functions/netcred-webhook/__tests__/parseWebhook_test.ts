import { assertEquals } from "std/testing/asserts";
import {
  digestSha256Hex,
  extractProviderEventId,
  parseWebhookPayload,
} from "../parseWebhook.ts";

Deno.test("parseWebhookPayload returns object for valid JSON", () => {
  assertEquals(parseWebhookPayload('{"id":"evt-1","type":"charge.paid"}'), {
    id: "evt-1",
    type: "charge.paid",
  });
});

Deno.test("parseWebhookPayload marks invalid JSON as unparsed", () => {
  assertEquals(parseWebhookPayload("not-json"), { _unparsed: true });
});

Deno.test("parseWebhookPayload marks arrays and primitives as unparsed", () => {
  assertEquals(parseWebhookPayload("[1,2]"), { _unparsed: true });
  assertEquals(parseWebhookPayload('"string"'), { _unparsed: true });
  assertEquals(parseWebhookPayload("null"), { _unparsed: true });
});

Deno.test("extractProviderEventId prefers top-level string id", async () => {
  const raw = '{"id":" evt-1 ","eventId":"evt-2"}';
  const payload = parseWebhookPayload(raw);
  assertEquals(await extractProviderEventId(raw, payload), "evt-1");
});

Deno.test("extractProviderEventId accepts nested and numeric candidates", async () => {
  assertEquals(
    await extractProviderEventId("{}", { data: { id: 42 } }),
    "42",
  );
  assertEquals(
    await extractProviderEventId("{}", { transaction: { id: "tx-9" } }),
    "tx-9",
  );
  assertEquals(
    await extractProviderEventId("{}", { charge: { id: "ch-9" } }),
    "ch-9",
  );
  assertEquals(
    await extractProviderEventId("{}", { event_id: "legacy-1" }),
    "legacy-1",
  );
});

Deno.test("extractProviderEventId falls back to SHA-256 of raw body", async () => {
  const raw = '{"type":"unknown"}';
  const expected = await digestSha256Hex(raw);
  assertEquals(await extractProviderEventId(raw, parseWebhookPayload(raw)), expected);
});
