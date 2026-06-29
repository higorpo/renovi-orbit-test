import { assertEquals } from "std/testing/asserts";
import { validateCronAuth } from "../cron-auth.ts";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.com/cron", {
    method: "POST",
    headers,
  });
}

Deno.test("validateCronAuth accepts matching cron secret header", () => {
  Deno.env.set("PAYMENTS_CRON_SECRET", "cron-secret");
  Deno.env.set("ENVIRONMENT", "production");

  try {
    const result = validateCronAuth(
      requestWithHeaders({ "X-Payments-Cron-Secret": "cron-secret" }),
    );
    assertEquals(result, { ok: true });
  } finally {
    Deno.env.delete("PAYMENTS_CRON_SECRET");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("validateCronAuth rejects missing secret in production", () => {
  Deno.env.set("ENVIRONMENT", "production");
  Deno.env.delete("PAYMENTS_CRON_SECRET");

  try {
    const result = validateCronAuth(requestWithHeaders({}));
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.status, 401);
      assertEquals(result.code, "unauthorized");
    }
  } finally {
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("validateCronAuth allows service role fallback outside production", () => {
  Deno.env.set("ENVIRONMENT", "development");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.delete("PAYMENTS_CRON_SECRET");

  try {
    const result = validateCronAuth(
      requestWithHeaders({ Authorization: "Bearer service-role-key" }),
    );
    assertEquals(result, { ok: true });
  } finally {
    Deno.env.delete("ENVIRONMENT");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});
