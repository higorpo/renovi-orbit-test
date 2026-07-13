import { assertEquals, assertRejects, assertThrows } from "std/testing/asserts";
import {
  NETCRED_API_BASE_URL_ENV,
  PAYMENT_GATEWAY_SLUG,
  PAYMENT_PLATFORM_CONSTANT_DEFAULTS,
  PAYMENT_PLATFORM_CONSTANT_KEYS,
  SUPPORTED_PAYMENT_METHODS,
  buildNetCredAuthorizationHeader,
  getConstantWithFallback,
  loadPaymentPlatformConstants,
  parseNumericConstant,
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

Deno.test("getConstantWithFallback warns and returns fallback when key is missing", () => {
  const warnings: Array<Record<string, unknown> | undefined> = [];
  const value = getConstantWithFallback(
    new Map(),
    "max_charge_attempts",
    3,
    (_event, context) => warnings.push(context),
  );
  assertEquals(value, 3);
  assertEquals(warnings[0]?.key, "max_charge_attempts");
  assertEquals(warnings[0]?.fallback, 3);
});

Deno.test("parseNumericConstant accepts numbers and numeric strings", () => {
  assertEquals(parseNumericConstant(12.5), 12.5);
  assertEquals(parseNumericConstant(" 3.5 "), 3.5);
  assertEquals(parseNumericConstant(""), null);
  assertEquals(parseNumericConstant("abc"), null);
  assertEquals(parseNumericConstant(Number.NaN), null);
  assertEquals(parseNumericConstant(null), null);
  assertEquals(parseNumericConstant({}), null);
});

Deno.test("buildNetCredAuthorizationHeader prefixes JWT", () => {
  assertEquals(buildNetCredAuthorizationHeader("tok-1"), "JWT tok-1");
});

Deno.test("resolvePaymentPlatformConstants overrides valid row values", () => {
  const resolved = resolvePaymentPlatformConstants([
    { key: "max_charge_attempts", value: "7" },
    { key: "charge_retry_interval_minutes", value: 45 },
  ]);
  assertEquals(resolved.max_charge_attempts, 7);
  assertEquals(resolved.charge_retry_interval_minutes, 45);
  assertEquals(
    resolved.cc_fixed_processing_fee_brl,
    PAYMENT_PLATFORM_CONSTANT_DEFAULTS.cc_fixed_processing_fee_brl,
  );
  assertEquals(
    resolved.cc_risk_analysis_fee_brl,
    PAYMENT_PLATFORM_CONSTANT_DEFAULTS.cc_risk_analysis_fee_brl,
  );
});

Deno.test("loadPaymentPlatformConstants maps rows from supabase client", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [{ key: "max_charge_attempts", value: 9 }],
          error: null,
        }),
      }),
    }),
  };

  const resolved = await loadPaymentPlatformConstants(
    supabase as never,
  );
  assertEquals(resolved.max_charge_attempts, 9);
});

Deno.test("loadPaymentPlatformConstants throws on supabase error", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: null,
          error: { message: "permission denied" },
        }),
      }),
    }),
  };

  await assertRejects(
    () => loadPaymentPlatformConstants(supabase as never),
    Error,
    "permission denied",
  );
});

Deno.test("getConstantWithFallback uses default warn when omitted", () => {
  assertEquals(
    getConstantWithFallback(new Map([["max_charge_attempts", 4]]), "max_charge_attempts", 3),
    4,
  );
  assertEquals(
    getConstantWithFallback(new Map(), "max_charge_attempts", 3),
    3,
  );
});

Deno.test("loadPaymentPlatformConstants treats null data as empty rows", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: null,
          error: null,
        }),
      }),
    }),
  };

  const resolved = await loadPaymentPlatformConstants(supabase as never);
  assertEquals(resolved.max_charge_attempts, PAYMENT_PLATFORM_CONSTANT_DEFAULTS.max_charge_attempts);
});

Deno.test("resolveNetCredApiBaseUrl rejects blank trimmed URL", () => {
  assertThrows(
    () =>
      resolveNetCredApiBaseUrl((key) =>
        key === NETCRED_API_BASE_URL_ENV ? "   " : undefined
      ),
    Error,
    NETCRED_API_BASE_URL_ENV,
  );
});
