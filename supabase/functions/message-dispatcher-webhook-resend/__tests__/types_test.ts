import { assertEquals } from "std/testing/asserts";
import { parseResendWebhookPayload } from "../types.ts";

Deno.test("parseResendWebhookPayload accepts Resend delivery event", () => {
  const event = parseResendWebhookPayload(
    JSON.stringify({
      type: "email.delivered",
      created_at: "2026-05-22T12:00:00Z",
      data: { email_id: "re_123" },
    }),
  );

  assertEquals(event?.type, "email.delivered");
  assertEquals(event?.data?.email_id, "re_123");
});

Deno.test("parseResendWebhookPayload rejects invalid JSON", () => {
  assertEquals(parseResendWebhookPayload("not-json"), null);
  assertEquals(parseResendWebhookPayload('{"data":{}}'), null);
});
