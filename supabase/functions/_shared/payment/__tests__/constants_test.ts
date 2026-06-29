import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  NETCRED_API_BASE_URL_ENV,
  PAYMENT_GATEWAY_SLUG,
  PAYMENT_PLATFORM_CONSTANT_DEFAULTS,
  PAYMENT_PLATFORM_CONSTANT_KEYS,
  SUPPORTED_PAYMENT_METHODS,
  getConstantWithFallback,
  resolveNetCredApiBaseUrl,
  resolvePaymentPlatformConstants,
} from "../constants.ts";

Deno.test("Option A gateway config exposes netcred slug and CREDIT_CARD only", () => {
  assertEquals(PAYMENT_GATEWAY_SLUG, "netcred");
  assertEquals(SUPPORTED_PAYMENT_METHODS, ["CREDIT_CARD"]);
});

Deno.test("resolveNetCredApiBaseUrl trims trailing slashes", () => {
  assertEquals(
    resolveNetCredApiBaseUrl((key) =>
      key === NETCRED_API_BASE_URL_ENV ? "https://api.example.com/" : undefined
    ),
    "https://api.example.com",
  );
});

Deno.test("resolveNetCredApiBaseUrl throws when env is missing", () => {
  assertThrows(
    () => resolveNetCredApiBaseUrl(() => undefined),
    Error,
    NETCRED_API_BASE_URL_ENV,
  );
});

Deno.test("resolvePaymentPlatformConstants uses defaults for all keys when rows are empty", () => {
  const warnings: Array<{ event: string; context?: Record<string, unknown> }> =
    [];

  const resolved = resolvePaymentPlatformConstants([], (event, context) => {
    warnings.push({ event, context });
  });

  assertEquals(resolved, PAYMENT_PLATFORM_CONSTANT_DEFAULTS);
  assertEquals(warnings.length, PAYMENT_PLATFORM_CONSTANT_KEYS.length);
  assertEquals(
    warnings.every((entry) => entry.event === "platform_constant_missing"),
    true,
  );
});

Deno.test("getConstantWithFallback overrides present keys and warns on invalid values", () => {
  const warnings: string[] = [];
  const byKey = new Map<string, unknown>([
    ["max_charge_attempts", 5],
    ["charge_retry_interval_minutes", "not-a-number"],
  ]);

  assertEquals(
    getConstantWithFallback(
      byKey,
      "max_charge_attempts",
      3,
      (event, context) => warnings.push(`${event}:${String(context?.key)}`),
    ),
    5,
  );
  assertEquals(
    getConstantWithFallback(
      byKey,
      "charge_retry_interval_minutes",
      30,
      (event, context) => warnings.push(`${event}:${String(context?.key)}`),
    ),
    30,
  );
  assertEquals(
    warnings.includes("platform_constant_missing:charge_retry_interval_minutes"),
    true,
  );
});
