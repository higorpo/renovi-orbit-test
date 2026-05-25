import { assertEquals } from "std/testing/asserts";
import { validateWorkerAuth } from "../auth.ts";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/worker", { method: "POST", headers });
}

Deno.test("validateWorkerAuth accepts X-Dispatcher-Secret", () => {
  Deno.env.set("DISPATCHER_CRON_SECRET", "cron-test-secret");
  try {
    const result = validateWorkerAuth(
      requestWith({ "X-Dispatcher-Secret": "cron-test-secret" }),
    );
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("DISPATCHER_CRON_SECRET");
  }
});

Deno.test("validateWorkerAuth accepts service_role bearer", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  try {
    const result = validateWorkerAuth(
      requestWith({ Authorization: "Bearer service-role-key" }),
    );
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateWorkerAuth rejects missing credentials", () => {
  Deno.env.delete("DISPATCHER_CRON_SECRET");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  const result = validateWorkerAuth(requestWith({}));
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 401);
});
