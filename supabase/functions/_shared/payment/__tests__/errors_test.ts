import { assertEquals } from "std/testing/asserts";
import {
  BillingAddressRequiredError,
  NetCredTokenRefreshTimeoutError,
  ProviderAuthError,
  SandboxCredentialsError,
} from "../errors.ts";

Deno.test("ProviderAuthError uses default message and name", () => {
  const err = new ProviderAuthError();
  assertEquals(err.name, "ProviderAuthError");
  assertEquals(err.message, "NETCRED_AUTH_FAILURE");
  assertEquals(err instanceof Error, true);
});

Deno.test("ProviderAuthError accepts custom message", () => {
  const err = new ProviderAuthError("custom auth");
  assertEquals(err.message, "custom auth");
});

Deno.test("SandboxCredentialsError uses default message and name", () => {
  const err = new SandboxCredentialsError();
  assertEquals(err.name, "SandboxCredentialsError");
  assertEquals(err.message, "SANDBOX_CREDENTIALS_IN_PRODUCTION");
});

Deno.test("NetCredTokenRefreshTimeoutError uses default message and name", () => {
  const err = new NetCredTokenRefreshTimeoutError();
  assertEquals(err.name, "NetCredTokenRefreshTimeoutError");
  assertEquals(err.message, "NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT");
});

Deno.test("BillingAddressRequiredError uses default message and name", () => {
  const err = new BillingAddressRequiredError();
  assertEquals(err.name, "BillingAddressRequiredError");
  assertEquals(err.message, "BILLING_ADDRESS_REQUIRED");
});
