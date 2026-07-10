import { assertEquals } from "std/testing/asserts";
import {
  buildChargeError,
  buildRetryableError,
  buildTerminalError,
  getPrimaryGatewayError,
  is5xxStatus,
  isAbortError,
  isNetworkError,
  isReferenceCodeConflict,
  isTerminalGatewayError,
} from "../netcred-charge-errors.ts";

Deno.test("isAbortError detects AbortError DOMException", () => {
  assertEquals(isAbortError(new DOMException("aborted", "AbortError")), true);
  assertEquals(isAbortError(new DOMException("other", "TimeoutError")), false);
  assertEquals(isAbortError(new Error("aborted")), false);
});

Deno.test("isNetworkError is true for AbortError and TypeError", () => {
  assertEquals(isNetworkError(new DOMException("aborted", "AbortError")), true);
  assertEquals(isNetworkError(new TypeError("fetch failed")), true);
  assertEquals(isNetworkError(new Error("boom")), false);
  assertEquals(isNetworkError("string"), false);
});

Deno.test("is5xxStatus matches only 500-599", () => {
  assertEquals(is5xxStatus(499), false);
  assertEquals(is5xxStatus(500), true);
  assertEquals(is5xxStatus(503), true);
  assertEquals(is5xxStatus(599), true);
  assertEquals(is5xxStatus(600), false);
});

Deno.test("isReferenceCodeConflict detects known codes, field and message patterns", () => {
  assertEquals(isReferenceCodeConflict(undefined), false);
  assertEquals(isReferenceCodeConflict([]), false);

  assertEquals(
    isReferenceCodeConflict([{ code: "REFERENCE_CODE_ALREADY_EXISTS" }]),
    true,
  );
  assertEquals(
    isReferenceCodeConflict([{ code: "SOME_REFERENCE_CODE_ERROR" }]),
    true,
  );
  assertEquals(
    isReferenceCodeConflict([{ field: "referenceCode", message: "taken" }]),
    true,
  );
  assertEquals(
    isReferenceCodeConflict([{ message: "duplicate reference code" }]),
    true,
  );
  assertEquals(
    isReferenceCodeConflict([{ code: "OTHER", message: "unrelated" }]),
    false,
  );
});

Deno.test("isTerminalGatewayError matches terminal codes only", () => {
  assertEquals(isTerminalGatewayError(undefined), false);
  assertEquals(isTerminalGatewayError([{ code: "REJECTED" }]), true);
  assertEquals(isTerminalGatewayError([{ code: "CPF_INVALID" }]), true);
  assertEquals(isTerminalGatewayError([{ code: "TEMPORARY" }]), false);
});

Deno.test("getPrimaryGatewayError returns first error", () => {
  assertEquals(getPrimaryGatewayError(undefined), undefined);
  assertEquals(
    getPrimaryGatewayError([
      { code: "A", message: "first" },
      { code: "B", message: "second" },
    ]),
    { code: "A", message: "first" },
  );
});

Deno.test("buildChargeError / buildRetryableError / buildTerminalError shapes", () => {
  assertEquals(buildChargeError("RETRYABLE", "msg", "ORIG"), {
    code: "RETRYABLE",
    message: "msg",
    originalCode: "ORIG",
  });
  assertEquals(buildRetryableError("retry me"), {
    code: "RETRYABLE",
    message: "retry me",
    originalCode: undefined,
  });
  assertEquals(buildTerminalError("stop", "REJECTED"), {
    code: "TERMINAL",
    message: "stop",
    originalCode: "REJECTED",
  });
});
