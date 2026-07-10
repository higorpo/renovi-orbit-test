import { assertEquals, assertThrows } from "std/testing/asserts";
import { createServiceRoleClient } from "../serviceRoleClient.ts";

Deno.test("createServiceRoleClient throws when SUPABASE_URL is missing", () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  try {
    assertThrows(
      () => createServiceRoleClient(),
      Error,
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("createServiceRoleClient throws when service role key is missing", () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  try {
    assertThrows(
      () => createServiceRoleClient(),
      Error,
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("createServiceRoleClient returns a client when env is set", () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  try {
    const client = createServiceRoleClient();
    assertEquals(typeof client.from, "function");
    assertEquals(typeof client.auth.getUser, "function");
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});
