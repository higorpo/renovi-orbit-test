import { assertEquals } from "std/testing/asserts";
import {
  computeSvixSignature,
  decodeSvixSecret,
  extractSvixHeaders,
  verifySvixWebhook,
} from "../svix.ts";

Deno.test("decodeSvixSecret strips whsec_ prefix and base64-decodes", () => {
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const bytes = decodeSvixSecret(secret);
  assertEquals(bytes instanceof Uint8Array, true);
  assertEquals(bytes.length > 0, true);
});

Deno.test("decodeSvixSecret works without whsec_ prefix", () => {
  const rawBase64 = "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const bytes = decodeSvixSecret(rawBase64);
  assertEquals(bytes instanceof Uint8Array, true);
  assertEquals(bytes.length > 0, true);
});

Deno.test("decodeSvixSecret with and without prefix produces same output", () => {
  const withPrefix = decodeSvixSecret("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw");
  const withoutPrefix = decodeSvixSecret("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw");
  assertEquals(withPrefix.length, withoutPrefix.length);
  for (let i = 0; i < withPrefix.length; i++) {
    assertEquals(withPrefix[i], withoutPrefix[i]);
  }
});

Deno.test("decodeSvixSecret trims whitespace", () => {
  const bytes = decodeSvixSecret("  whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw  ");
  assertEquals(bytes.length > 0, true);
});

Deno.test("extractSvixHeaders returns null when svix-id is missing", () => {
  const req = new Request("https://example.com", {
    headers: { "svix-timestamp": "123", "svix-signature": "v1,abc" },
  });
  assertEquals(extractSvixHeaders(req), null);
});

Deno.test("extractSvixHeaders returns null when svix-timestamp is missing", () => {
  const req = new Request("https://example.com", {
    headers: { "svix-id": "msg_1", "svix-signature": "v1,abc" },
  });
  assertEquals(extractSvixHeaders(req), null);
});

Deno.test("extractSvixHeaders returns null when svix-signature is missing", () => {
  const req = new Request("https://example.com", {
    headers: { "svix-id": "msg_1", "svix-timestamp": "123" },
  });
  assertEquals(extractSvixHeaders(req), null);
});

Deno.test("extractSvixHeaders returns all three headers", () => {
  const req = new Request("https://example.com", {
    headers: {
      "svix-id": "msg_1",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,sig",
    },
  });
  const headers = extractSvixHeaders(req);
  assertEquals(headers?.id, "msg_1");
  assertEquals(headers?.timestamp, "1700000000");
  assertEquals(headers?.signature, "v1,sig");
});

Deno.test("verifySvixWebhook accepts multiple v1 signatures (space-separated)", async () => {
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const payload = '{"type":"email.sent"}';
  const msgId = "msg_multi";
  const timestamp = String(Math.floor(Date.now() / 1000));

  const validSig = await computeSvixSignature(secret, msgId, timestamp, payload);
  const multiSig = `v1,invalidFakeSignature v1,${validSig}`;

  const result = await verifySvixWebhook(payload, {
    id: msgId,
    timestamp,
    signature: multiSig,
  }, secret);

  assertEquals(result, true);
});

Deno.test("verifySvixWebhook rejects future timestamp beyond tolerance", async () => {
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const payload = '{"type":"email.sent"}';
  const futureTs = String(Math.floor(Date.now() / 1000) + 600);
  const sig = await computeSvixSignature(secret, "msg_fut", futureTs, payload);

  const result = await verifySvixWebhook(payload, {
    id: "msg_fut",
    timestamp: futureTs,
    signature: `v1,${sig}`,
  }, secret, 300);

  assertEquals(result, false);
});

Deno.test("verifySvixWebhook rejects non-numeric timestamp", async () => {
  const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const payload = '{"type":"email.sent"}';

  const result = await verifySvixWebhook(payload, {
    id: "msg_nan",
    timestamp: "not-a-number",
    signature: "v1,fake",
  }, secret);

  assertEquals(result, false);
});
