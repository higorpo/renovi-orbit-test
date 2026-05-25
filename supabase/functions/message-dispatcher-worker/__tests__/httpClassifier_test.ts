import { assertEquals } from "std/testing/asserts";
import {
  classifyProviderFailure,
  isRetryableProviderFailure,
  isTerminalResendError,
  normalizeResendErrorCode,
} from "../httpClassifier.ts";

Deno.test("isRetryableProviderFailure accepts 429/502/503", () => {
  assertEquals(isRetryableProviderFailure(429), true);
  assertEquals(isRetryableProviderFailure(502), true);
  assertEquals(isRetryableProviderFailure(503), true);
});

Deno.test("isRetryableProviderFailure accepts timeout with status 0", () => {
  assertEquals(isRetryableProviderFailure(0, "resend_timeout"), true);
  assertEquals(isRetryableProviderFailure(0, "fcm_timeout"), true);
});

Deno.test("classifyProviderFailure marks Resend 400 as terminal invalid_email", () => {
  const result = classifyProviderFailure("email", 400, "invalid_recipient");
  assertEquals(result.retryable, false);
  assertEquals(result.errorCode, "invalid_email");
});

Deno.test("classifyProviderFailure marks Resend 429 as retryable", () => {
  const result = classifyProviderFailure("email", 429, "rate_limit_exceeded");
  assertEquals(result.retryable, true);
});

Deno.test("classifyProviderFailure marks FCM invalid token as terminal", () => {
  assertEquals(isRetryableProviderFailure(404, "NOT_FOUND"), false);
  const result = classifyProviderFailure("push", 404, "NOT_FOUND");
  assertEquals(result.retryable, false);
  assertEquals(result.errorCode, "invalid_token");
});

Deno.test("normalizeResendErrorCode maps validation responses", () => {
  assertEquals(normalizeResendErrorCode(422, "validation_error"), "validation_error");
  assertEquals(isTerminalResendError(422, "validation_error"), true);
});
