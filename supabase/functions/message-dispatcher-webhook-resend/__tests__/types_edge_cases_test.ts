import { assertEquals } from "std/testing/asserts";
import { parseResendWebhookPayload } from "../types.ts";

Deno.test("parseResendWebhookPayload rejects empty string", () => {
  assertEquals(parseResendWebhookPayload(""), null);
  assertEquals(parseResendWebhookPayload("   "), null);
});

Deno.test("parseResendWebhookPayload rejects object without type field", () => {
  assertEquals(parseResendWebhookPayload('{"data":{"email_id":"re_1"}}'), null);
});

Deno.test("parseResendWebhookPayload rejects non-string type", () => {
  assertEquals(parseResendWebhookPayload('{"type":123}'), null);
});

Deno.test("parseResendWebhookPayload accepts event without data", () => {
  const event = parseResendWebhookPayload('{"type":"email.clicked"}');
  assertEquals(event?.type, "email.clicked");
  assertEquals(event?.data, undefined);
});

Deno.test("parseResendWebhookPayload accepts bounce event", () => {
  const event = parseResendWebhookPayload(JSON.stringify({
    type: "email.bounced",
    created_at: "2026-05-22T14:00:00Z",
    data: { email_id: "re_bounce_1", bounce_type: "hard" },
  }));
  assertEquals(event?.type, "email.bounced");
  assertEquals(event?.data?.bounce_type, "hard");
});

Deno.test("parseResendWebhookPayload accepts complaint event", () => {
  const event = parseResendWebhookPayload(JSON.stringify({
    type: "email.complained",
    data: { email_id: "re_complaint" },
  }));
  assertEquals(event?.type, "email.complained");
});
