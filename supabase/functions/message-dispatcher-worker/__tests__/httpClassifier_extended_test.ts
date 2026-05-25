import { assertEquals } from "std/testing/asserts";
import {
  classifyProviderFailure,
  isInvalidFcmTokenError,
  isRetryableProviderFailure,
  isTerminalResendError,
  normalizeFcmErrorCode,
  normalizeResendErrorCode,
} from "../httpClassifier.ts";

// --- isInvalidFcmTokenError extended ---

Deno.test("isInvalidFcmTokenError recognizes 'unregistered' in error code", () => {
  assertEquals(isInvalidFcmTokenError(400, "UNREGISTERED"), true);
});

Deno.test("isInvalidFcmTokenError recognizes 'invalid_token' error code", () => {
  assertEquals(isInvalidFcmTokenError(200, "invalid_token"), true);
});

Deno.test("isInvalidFcmTokenError returns false for rate limit", () => {
  assertEquals(isInvalidFcmTokenError(429, "RESOURCE_EXHAUSTED"), false);
});

// --- isTerminalResendError extended ---

Deno.test("isTerminalResendError identifies invalid_email in error code", () => {
  assertEquals(isTerminalResendError(400, "invalid_email_address"), true);
});

Deno.test("isTerminalResendError identifies invalid_recipient in error code", () => {
  assertEquals(isTerminalResendError(400, "invalid_recipient"), true);
});

Deno.test("isTerminalResendError returns false for 429 rate limit", () => {
  assertEquals(isTerminalResendError(429, "rate_limit_exceeded"), false);
});

Deno.test("isTerminalResendError returns false for 503 unavailable", () => {
  assertEquals(isTerminalResendError(503, "service_unavailable"), false);
});

// --- normalizeFcmErrorCode ---

Deno.test("normalizeFcmErrorCode maps 404 to invalid_token", () => {
  assertEquals(normalizeFcmErrorCode(404, "NOT_FOUND"), "invalid_token");
});

Deno.test("normalizeFcmErrorCode maps timeout to fcm_timeout", () => {
  assertEquals(normalizeFcmErrorCode(0, "fcm_timeout"), "fcm_timeout");
});

Deno.test("normalizeFcmErrorCode preserves original code when no special case", () => {
  assertEquals(normalizeFcmErrorCode(500, "INTERNAL"), "INTERNAL");
});

Deno.test("normalizeFcmErrorCode defaults to fcm_send_failed when code is null", () => {
  assertEquals(normalizeFcmErrorCode(500, null), "fcm_send_failed");
});

// --- normalizeResendErrorCode ---

Deno.test("normalizeResendErrorCode maps 422 to validation_error", () => {
  assertEquals(normalizeResendErrorCode(422, "validation_error"), "validation_error");
});

Deno.test("normalizeResendErrorCode maps email-related 400 to invalid_email", () => {
  assertEquals(normalizeResendErrorCode(400, "invalid_email_address"), "invalid_email");
});

Deno.test("normalizeResendErrorCode maps timeout to resend_timeout", () => {
  assertEquals(normalizeResendErrorCode(0, "resend_timeout"), "resend_timeout");
});

Deno.test("normalizeResendErrorCode defaults to resend_send_failed when code is null", () => {
  assertEquals(normalizeResendErrorCode(500, null), "resend_send_failed");
});

// --- classifyProviderFailure for push timeout ---

Deno.test("classifyProviderFailure marks push timeout as retryable", () => {
  const result = classifyProviderFailure("push", 0, "fcm_timeout");
  assertEquals(result.retryable, true);
  assertEquals(result.errorCode, "fcm_timeout");
});

// --- classifyProviderFailure for email timeout ---

Deno.test("classifyProviderFailure marks email timeout as retryable", () => {
  const result = classifyProviderFailure("email", 0, "resend_timeout");
  assertEquals(result.retryable, true);
  assertEquals(result.errorCode, "resend_timeout");
});

// --- classifyProviderFailure for 502 ---

Deno.test("classifyProviderFailure marks email 502 as retryable", () => {
  const result = classifyProviderFailure("email", 502, "bad_gateway");
  assertEquals(result.retryable, true);
});

// --- isRetryableProviderFailure guards against invalid token marking retryable ---

Deno.test("isRetryableProviderFailure returns false for FCM invalid token even with retryable status", () => {
  assertEquals(isRetryableProviderFailure(404, "NOT_FOUND"), false);
});

Deno.test("isRetryableProviderFailure returns false for Resend terminal even with 0 status", () => {
  assertEquals(isRetryableProviderFailure(400, "invalid_email"), false);
});
