import { assertEquals } from "std/testing/asserts";
import {
  ORBIT_CRON_SECRET_HEADER,
  validateOrbitCronAuth,
} from "../orbit-cron-auth.ts";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.com/internal", {
    method: "POST",
    headers,
  });
}

Deno.test("validateOrbitCronAuth accepts matching cron secret header", () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ [ORBIT_CRON_SECRET_HEADER]: "orbit-cron-secret" }),
    );
    assertEquals(result, { ok: true });
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("validateOrbitCronAuth rejects wrong cron secret", () => {
  Deno.env.set("ORBIT_CRON_SECRET", "correct-secret");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ [ORBIT_CRON_SECRET_HEADER]: "wrong-secret" }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.status, 401);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("validateOrbitCronAuth accepts service_role bearer", () => {
  Deno.env.delete("ORBIT_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ Authorization: "Bearer service-role-key" }),
    );
    assertEquals(result, { ok: true });
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateOrbitCronAuth rejects wrong bearer token", () => {
  Deno.env.delete("ORBIT_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "correct-key");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ Authorization: "Bearer wrong-key" }),
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

Deno.test("validateOrbitCronAuth rejects Authorization without Bearer prefix", () => {
  Deno.env.delete("ORBIT_CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ Authorization: "Basic service-key" }),
    );
    assertEquals(result.ok, false);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateOrbitCronAuth prefers cron secret over bearer when both present", () => {
  Deno.env.set("ORBIT_CRON_SECRET", "cron-secret");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({
        [ORBIT_CRON_SECRET_HEADER]: "cron-secret",
        Authorization: "Bearer wrong-key",
      }),
    );
    assertEquals(result, { ok: true });
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("validateOrbitCronAuth rejects missing credentials", () => {
  Deno.env.delete("ORBIT_CRON_SECRET");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  const result = validateOrbitCronAuth(requestWithHeaders({}));
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 401);
});

Deno.test("validateOrbitCronAuth rejects empty string secrets", () => {
  Deno.env.set("ORBIT_CRON_SECRET", "");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

  try {
    const result = validateOrbitCronAuth(
      requestWithHeaders({ [ORBIT_CRON_SECRET_HEADER]: "" }),
    );
    assertEquals(result.ok, false);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});
