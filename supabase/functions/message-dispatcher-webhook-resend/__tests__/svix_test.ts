import { assertEquals } from "std/testing/asserts";
import {
  computeSvixSignature,
  verifyResendWebhookRequest,
  verifySvixWebhook,
} from "../svix.ts";

const TEST_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

async function signedRequest(
  payload: string,
  overrides?: { signature?: string; timestamp?: string; id?: string },
): Promise<{ req: Request; rawBody: string }> {
  const id = overrides?.id ?? "msg_test_1";
  const timestamp = overrides?.timestamp ??
    String(Math.floor(Date.now() / 1000));
  const signature = overrides?.signature ??
    `v1,${await computeSvixSignature(TEST_SECRET, id, timestamp, payload)}`;

  return {
    rawBody: payload,
    req: new Request("https://example.com/webhook", {
      method: "POST",
      headers: {
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
      body: payload,
    }),
  };
}

Deno.test("verifyResendWebhookRequest fails when RESEND_WEBHOOK_SECRET unset", async () => {
  const prev = Deno.env.get("RESEND_WEBHOOK_SECRET");
  Deno.env.delete("RESEND_WEBHOOK_SECRET");

  try {
    const result = await verifyResendWebhookRequest(
      new Request("https://example.com", { method: "POST", body: "{}" }),
      "{}",
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.code, "resend_webhook_secret_missing");
      assertEquals(result.status, 500);
    }
  } finally {
    if (prev !== undefined) Deno.env.set("RESEND_WEBHOOK_SECRET", prev);
  }
});

Deno.test("verifyResendWebhookRequest rejects missing Svix headers", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_SECRET);
  try {
    const result = await verifyResendWebhookRequest(
      new Request("https://example.com", { method: "POST", body: "{}" }),
      "{}",
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.code, "svix_headers_missing");
      assertEquals(result.status, 401);
    }
  } finally {
    Deno.env.delete("RESEND_WEBHOOK_SECRET");
  }
});

Deno.test("verifyResendWebhookRequest accepts valid Svix signature", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_SECRET);
  try {
    const payload = '{"type":"email.delivered","data":{"email_id":"re_1"}}';
    const { req, rawBody } = await signedRequest(payload);
    const result = await verifyResendWebhookRequest(req, rawBody);
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("RESEND_WEBHOOK_SECRET");
  }
});

Deno.test("verifyResendWebhookRequest rejects tampered payload", async () => {
  Deno.env.set("RESEND_WEBHOOK_SECRET", TEST_SECRET);
  try {
    const payload = '{"type":"email.delivered"}';
    const { req } = await signedRequest(payload);
    const result = await verifyResendWebhookRequest(req, '{"type":"email.bounced"}');
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.code, "invalid_signature");
  } finally {
    Deno.env.delete("RESEND_WEBHOOK_SECRET");
  }
});

Deno.test("verifySvixWebhook rejects stale timestamp", async () => {
  const payload = '{"type":"email.delivered"}';
  const staleTs = String(Math.floor(Date.now() / 1000) - 600);
  const sig = await computeSvixSignature(TEST_SECRET, "msg_stale", staleTs, payload);
  const valid = await verifySvixWebhook(payload, {
    id: "msg_stale",
    timestamp: staleTs,
    signature: `v1,${sig}`,
  }, TEST_SECRET, 300);
  assertEquals(valid, false);
});
