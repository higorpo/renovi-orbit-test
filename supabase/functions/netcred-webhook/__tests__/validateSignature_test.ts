import { assertEquals } from "std/testing/asserts";
import { computeHMACSHA256 } from "../../_shared/crypto/hmac.ts";
import { validateNetcredWebhookSignature } from "../validateSignature.ts";

const SECRET = "test-webhook-secret";
const RAW_BODY = '{"id":"evt-sig-1","amount":100.5}';

Deno.test("validateNetcredWebhookSignature accepts valid HMAC via timingSafeEqual", async () => {
  const signature = await computeHMACSHA256(SECRET, RAW_BODY);

  const valid = await validateNetcredWebhookSignature(RAW_BODY, signature, SECRET);
  assertEquals(valid, true);
});

Deno.test("validateNetcredWebhookSignature rejects tampered raw body", async () => {
  const signature = await computeHMACSHA256(SECRET, RAW_BODY);
  const tamperedBody = '{"id":"evt-sig-1","amount":100.50}';

  const valid = await validateNetcredWebhookSignature(
    tamperedBody,
    signature,
    SECRET,
  );
  assertEquals(valid, false);
});

Deno.test("validateNetcredWebhookSignature rejects same-length wrong digest", async () => {
  const signature = await computeHMACSHA256(SECRET, RAW_BODY);
  const wrongSameLength = signature
    .split("")
    .map((char, index) => (index === 0 ? (char === "a" ? "b" : "a") : char))
    .join("");

  assertEquals(signature.length, wrongSameLength.length);
  const valid = await validateNetcredWebhookSignature(
    RAW_BODY,
    wrongSameLength,
    SECRET,
  );
  assertEquals(valid, false);
});

Deno.test("validateNetcredWebhookSignature rejects empty signature header", async () => {
  const valid = await validateNetcredWebhookSignature(RAW_BODY, "", SECRET);
  assertEquals(valid, false);
});

Deno.test("validateNetcredWebhookSignature normalizes uppercase digest header", async () => {
  const signature = (await computeHMACSHA256(SECRET, RAW_BODY)).toUpperCase();

  const valid = await validateNetcredWebhookSignature(RAW_BODY, signature, SECRET);
  assertEquals(valid, true);
});
