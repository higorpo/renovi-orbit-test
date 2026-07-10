import { assertEquals } from "std/testing/asserts";
import { getCorsHeaders } from "../cors.ts";

Deno.test("getCorsHeaders always returns base Allow-Headers and Allow-Methods", () => {
  const prev = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.delete("ALLOWED_ORIGINS");
  try {
    const headers = getCorsHeaders(new Request("https://example.com", {
      headers: { Origin: "https://app.example.com" },
    }));
    assertEquals(
      headers["Access-Control-Allow-Headers"],
      "authorization, x-client-info, apikey, content-type",
    );
    assertEquals(headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
    assertEquals(headers["Access-Control-Allow-Origin"], undefined);
  } finally {
    if (prev === undefined) Deno.env.delete("ALLOWED_ORIGINS");
    else Deno.env.set("ALLOWED_ORIGINS", prev);
  }
});

Deno.test("getCorsHeaders sets Allow-Origin when Origin is allowlisted", () => {
  const prev = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set(
    "ALLOWED_ORIGINS",
    "https://app.example.com, http://localhost:5173",
  );
  try {
    const headers = getCorsHeaders(new Request("https://example.com", {
      headers: { Origin: "http://localhost:5173" },
    }));
    assertEquals(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
  } finally {
    if (prev === undefined) Deno.env.delete("ALLOWED_ORIGINS");
    else Deno.env.set("ALLOWED_ORIGINS", prev);
  }
});

Deno.test("getCorsHeaders omits Allow-Origin for unknown Origin", () => {
  const prev = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  try {
    const headers = getCorsHeaders(new Request("https://example.com", {
      headers: { Origin: "https://evil.example.com" },
    }));
    assertEquals(headers["Access-Control-Allow-Origin"], undefined);
  } finally {
    if (prev === undefined) Deno.env.delete("ALLOWED_ORIGINS");
    else Deno.env.set("ALLOWED_ORIGINS", prev);
  }
});
