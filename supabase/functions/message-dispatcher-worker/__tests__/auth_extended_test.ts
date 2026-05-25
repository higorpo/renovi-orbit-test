import { assertEquals } from "std/testing/asserts";
import { validateWorkerAuth } from "../auth.ts";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/worker", { method: "POST", headers });
}

Deno.test("validateWorkerAuth rejects wrong cron secret", () => {
  Deno.env.set("DISPATCHER_CRON_SECRET", "correct-secret");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const result = validateWorkerAuth(
      requestWith({ "X-Dispatcher-Secret": "wrong-secret" }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.status, 401);
  } finally {
    Deno.env.delete("DISPATCHER_CRON_SECRET");
  }
});

Deno.test("validateWorkerAuth rejects wrong bearer token", () => {
  Deno.env.delete("DISPATCHER_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "correct-key");

  try {
    const result = validateWorkerAuth(
      requestWith({ Authorization: "Bearer wrong-key" }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.status, 401);
      assertEquals(result.code, "unauthorized");
    }
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateWorkerAuth rejects Authorization without Bearer prefix", () => {
  Deno.env.delete("DISPATCHER_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");

  try {
    const result = validateWorkerAuth(
      requestWith({ Authorization: "Basic service-key" }),
    );
    assertEquals(result.ok, false);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateWorkerAuth prefers cron secret over bearer when both present", () => {
  Deno.env.set("DISPATCHER_CRON_SECRET", "cron-secret");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");

  try {
    const result = validateWorkerAuth(
      requestWith({
        "X-Dispatcher-Secret": "cron-secret",
        Authorization: "Bearer wrong-key",
      }),
    );
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("DISPATCHER_CRON_SECRET");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateWorkerAuth accepts bearer even when cron secret is unset", () => {
  Deno.env.delete("DISPATCHER_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");

  try {
    const result = validateWorkerAuth(
      requestWith({ Authorization: "Bearer service-key" }),
    );
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateWorkerAuth rejects empty string secrets", () => {
  Deno.env.set("DISPATCHER_CRON_SECRET", "");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

  try {
    const result = validateWorkerAuth(
      requestWith({ "X-Dispatcher-Secret": "" }),
    );
    assertEquals(result.ok, false);
  } finally {
    Deno.env.delete("DISPATCHER_CRON_SECRET");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});
