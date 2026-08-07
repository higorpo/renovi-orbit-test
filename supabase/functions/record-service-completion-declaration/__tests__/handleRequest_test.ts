import { assertEquals, assertExists } from "std/testing/asserts";
import {
  handleRecordDeclarationRequest,
  lookupIpWhoIs,
  parseRecordDeclarationBody,
  type RecordDeclarationDeps,
} from "../handleRequest.ts";

function createDeps(
  overrides: Partial<RecordDeclarationDeps> = {},
): RecordDeclarationDeps {
  return {
    getUser: async () => ({ user: { id: "client-1" }, error: null }),
    lookupIpGeo: async () => ({
      country: "Brazil",
      region: "SP",
      city: "São Paulo",
      latitude: -23.5,
      longitude: -46.6,
      source: "ipwho.is",
    }),
    upsertDeclaration: async () => ({
      data: {
        ok: true,
        id: "decl-1",
        declared_at: "2026-08-07T12:00:00Z",
        last_seen_at: "2026-08-07T12:00:00Z",
      },
      error: null,
    }),
    checkRateLimit: async () => ({
      allowed: true,
      remaining: 29,
      retryAfter: 0,
    }),
    ...overrides,
  };
}

function requestWith(init: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Request {
  const headers = new Headers({
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
    ...init.headers,
  });
  return new Request("http://localhost/functions/v1/record-service-completion-declaration", {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

Deno.test("parseRecordDeclarationBody requires contractedServiceId", () => {
  const parsed = parseRecordDeclarationBody({ deviceId: "d1" });
  assertEquals(parsed.ok, false);
});

Deno.test("parseRecordDeclarationBody accepts camelCase device fields", () => {
  const parsed = parseRecordDeclarationBody({
    contractedServiceId: "cs-1",
    deviceId: "d1",
    platform: "web",
    clientTimezone: "America/Sao_Paulo",
  });
  assertEquals(parsed.ok, true);
  if (parsed.ok) {
    assertEquals(parsed.contractedServiceId, "cs-1");
    assertEquals(parsed.device.deviceId, "d1");
    assertEquals(parsed.device.clientTimezone, "America/Sao_Paulo");
  }
});

Deno.test("lookupIpWhoIs returns null for unknown IP", async () => {
  const result = await lookupIpWhoIs("unknown", async () => {
    throw new Error("should not fetch");
  });
  assertEquals(result, null);
});

Deno.test("lookupIpWhoIs maps successful ipwho.is payload", async () => {
  const result = await lookupIpWhoIs("203.0.113.10", async () =>
    new Response(
      JSON.stringify({
        success: true,
        country: "Brazil",
        region: "SP",
        city: "São Paulo",
        latitude: -23.5,
        longitude: -46.6,
      }),
      { status: 200 },
    )
  );
  assertEquals(result?.country, "Brazil");
  assertEquals(result?.source, "ipwho.is");
});

Deno.test("lookupIpWhoIs returns null when fetch fails", async () => {
  const result = await lookupIpWhoIs("203.0.113.10", async () => {
    throw new Error("network");
  });
  assertEquals(result, null);
});

Deno.test("returns 401 without JWT", async () => {
  const response = await handleRecordDeclarationRequest(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractedServiceId: "cs-1" }),
    }),
    createDeps(),
  );
  assertEquals(response.status, 401);
});

Deno.test("returns 429 when rate limited", async () => {
  const response = await handleRecordDeclarationRequest(
    requestWith({ body: { contractedServiceId: "cs-1" } }),
    createDeps({
      checkRateLimit: async () => ({
        allowed: false,
        remaining: 0,
        retryAfter: 12,
      }),
    }),
  );
  assertEquals(response.status, 429);
});

Deno.test("returns 400 when body is invalid", async () => {
  const response = await handleRecordDeclarationRequest(
    requestWith({ body: { deviceId: "only" } }),
    createDeps(),
  );
  assertEquals(response.status, 400);
});

Deno.test("happy path upserts with IP geo and device fields", async () => {
  let captured: Record<string, unknown> | null = null;
  const response = await handleRecordDeclarationRequest(
    requestWith({
      body: {
        contractedServiceId: "cs-1",
        deviceId: "device-9",
        platform: "android",
        userAgent: "ua",
      },
      headers: { "cf-connecting-ip": "203.0.113.55" },
    }),
    createDeps({
      upsertDeclaration: async (_auth, params) => {
        captured = params as unknown as Record<string, unknown>;
        return {
          data: {
            ok: true,
            id: "decl-9",
            declared_at: "2026-08-07T12:00:00Z",
            last_seen_at: "2026-08-07T12:00:00Z",
          },
          error: null,
        };
      },
    }),
  );
  assertEquals(response.status, 200);
  assertExists(captured);
  assertEquals(captured.contractedServiceId, "cs-1");
  assertEquals(captured.clientIp, "203.0.113.55");
  assertEquals(captured.deviceId, "device-9");
  assertEquals((captured.ipGeo as { city: string }).city, "São Paulo");
  const payload = await response.json();
  assertEquals(payload.ok, true);
  assertEquals(payload.id, "decl-9");
});

Deno.test("continues when IP geo lookup fails", async () => {
  let capturedIpGeo: unknown = "unset";
  const response = await handleRecordDeclarationRequest(
    requestWith({
      body: { contractedServiceId: "cs-1" },
      headers: { "cf-connecting-ip": "203.0.113.55" },
    }),
    createDeps({
      lookupIpGeo: async () => null,
      upsertDeclaration: async (_auth, params) => {
        capturedIpGeo = params.ipGeo;
        return {
          data: { ok: true, id: "decl-2", declared_at: "t", last_seen_at: "t" },
          error: null,
        };
      },
    }),
  );
  assertEquals(response.status, 200);
  assertEquals(capturedIpGeo, null);
});

Deno.test("maps SERVICE_NOT_FOUND_OR_UNAUTHORIZED to 403", async () => {
  const response = await handleRecordDeclarationRequest(
    requestWith({ body: { contractedServiceId: "cs-1" } }),
    createDeps({
      upsertDeclaration: async () => ({
        data: null,
        error: { message: "SERVICE_NOT_FOUND_OR_UNAUTHORIZED", code: "P0003" },
      }),
    }),
  );
  assertEquals(response.status, 403);
});
