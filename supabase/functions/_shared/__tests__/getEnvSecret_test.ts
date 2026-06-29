import { assertEquals, assertThrows } from "std/testing/asserts";
import { getEnvSecret } from "../getEnvSecret.ts";

Deno.test("getEnvSecret returns trimmed env value", () => {
  Deno.env.set("NETCRED_WEBHOOK_SECRET", "  webhook-secret  ");

  try {
    assertEquals(getEnvSecret("netcred_webhook_secret"), "webhook-secret");
  } finally {
    Deno.env.delete("NETCRED_WEBHOOK_SECRET");
  }
});

Deno.test("getEnvSecret throws when env var is missing", () => {
  Deno.env.delete("NETCRED_USERNAME");

  assertThrows(
    () => getEnvSecret("NETCRED_USERNAME"),
    Error,
    "SECRET_NOT_CONFIGURED:NETCRED_USERNAME",
  );
});
