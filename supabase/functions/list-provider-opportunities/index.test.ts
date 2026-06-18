import { assertEquals } from "std/testing/asserts";
import { join } from "std/path/mod";
import {
  handleListProviderOpportunitiesRequest,
  type ListProviderOpportunitiesDeps,
} from "./handleRequest.ts";
import {
  clampLimit,
  normalizeSortMode,
  parseListProviderOpportunitiesBody,
  validateCoordinates,
  validateNearestSortRequiresCoordinates,
} from "./parseBody.ts";
import { EMPTY_FEED_RESPONSE } from "./types.ts";

const configPath = join(Deno.cwd(), "supabase", "config.toml");

function requestWith(
  init: RequestInit & { headers?: Record<string, string> } = {},
): Request {
  return new Request("https://example.com/list-provider-opportunities", {
    method: "POST",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function createDeps(
  overrides: Partial<ListProviderOpportunitiesDeps> = {},
): ListProviderOpportunitiesDeps {
  return {
    getUser: async () => ({ user: { id: "provider-1" }, error: null }),
    getProfile: async () => ({
      profile: { role: "provider", operational_status: "active" },
      error: null,
    }),
    listOpportunities: async () => ({
      data: {
        items: [{ service_request_id: "sr-1" }],
        next_cursor: null,
        has_more: false,
      },
      error: null,
    }),
    checkRateLimit: async () => ({ allowed: true, remaining: 59, retryAfter: 0 }),
    ...overrides,
  };
}

const authedRequest = (body: Record<string, unknown> = {}) =>
  requestWith({
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify(body),
  });

Deno.test("list-provider-opportunities is registered in config.toml", async () => {
  const text = await Deno.readTextFile(configPath);
  assertEquals(text.includes("[functions.list-provider-opportunities]"), true);
});

Deno.test("clampLimit defaults to 20 and clamps to [1, 50]", () => {
  assertEquals(clampLimit(undefined), 20);
  assertEquals(clampLimit(0), 1);
  assertEquals(clampLimit(100), 50);
  assertEquals(clampLimit(25), 25);
});

Deno.test("parseListProviderOpportunitiesBody normalizes cursor and sort", () => {
  assertEquals(
    parseListProviderOpportunitiesBody({
      sort_mode: "nearest",
      cursor: "  abc  ",
      limit: 10,
      lat: -23.5,
      lng: -46.6,
    }),
    {
      sortMode: "nearest",
      cursor: "abc",
      limit: 10,
      lat: -23.5,
      lng: -46.6,
    },
  );
});

Deno.test("validateNearestSortRequiresCoordinates rejects missing coordinates", () => {
  assertEquals(
    validateNearestSortRequiresCoordinates("nearest", null, null),
    "nearest sort requires lat and lng",
  );
  assertEquals(
    validateNearestSortRequiresCoordinates("newest", null, null),
    null,
  );
});

Deno.test("validateCoordinates rejects partial or out-of-range values", () => {
  assertEquals(validateCoordinates(-23.5, null), "lat and lng must both be provided when either is set");
  assertEquals(validateCoordinates(91, 0), "Valid lat (-90..90) and lng (-180..180) are required");
});

Deno.test("normalizeSortMode falls back to newest", () => {
  assertEquals(normalizeSortMode("invalid"), "newest");
  assertEquals(normalizeSortMode("least_competitive"), "least_competitive");
});

Deno.test("returns 401 without JWT", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    requestWith({ body: JSON.stringify({}) }),
    createDeps(),
  );
  assertEquals(response.status, 401);
});

Deno.test("returns 401 when JWT validation fails", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest(),
    createDeps({
      getUser: async () => ({ user: null, error: new Error("invalid token") }),
    }),
  );
  assertEquals(response.status, 401);
});

Deno.test("returns empty feed for suspended provider without RPC", async () => {
  let rpcCalled = false;
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ sort_mode: "newest" }),
    createDeps({
      getProfile: async () => ({
        profile: { role: "provider", operational_status: "suspended" },
        error: null,
      }),
      listOpportunities: async () => {
        rpcCalled = true;
        return { data: null, error: null };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), EMPTY_FEED_RESPONSE);
  assertEquals(rpcCalled, false);
});

Deno.test("clamps limit before calling RPC", async () => {
  let capturedLimit = 0;
  await handleListProviderOpportunitiesRequest(
    authedRequest({ limit: 100 }),
    createDeps({
      listOpportunities: async (params) => {
        capturedLimit = params.limit;
        return { data: EMPTY_FEED_RESPONSE, error: null };
      },
    }),
  );
  assertEquals(capturedLimit, 50);
});

Deno.test("proxies RPC response for active provider", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ limit: 5 }),
    createDeps(),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.items.length, 1);
  assertEquals(body.has_more, false);
});

Deno.test("returns 403 for non-provider profile", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest(),
    createDeps({
      getProfile: async () => ({
        profile: { role: "client", operational_status: "active" },
        error: null,
      }),
    }),
  );

  assertEquals(response.status, 403);
});

Deno.test("returns 429 when rate limit exceeded", async () => {
  let rpcCalled = false;
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ sort_mode: "newest" }),
    createDeps({
      checkRateLimit: async () => ({ allowed: false, remaining: 0, retryAfter: 42 }),
      listOpportunities: async () => {
        rpcCalled = true;
        return { data: null, error: null };
      },
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "42");
  const body = await response.json();
  assertEquals(body.error, "rate_limited");
  assertEquals(body.retryAfter, 42);
  assertEquals(rpcCalled, false);
});

Deno.test("fail-open rate limit check allows request through", async () => {
  let rpcCalled = false;
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ sort_mode: "newest" }),
    createDeps({
      checkRateLimit: async () => ({ allowed: true, remaining: 60, retryAfter: 0 }),
      listOpportunities: async () => {
        rpcCalled = true;
        return { data: EMPTY_FEED_RESPONSE, error: null };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(rpcCalled, true);
});

Deno.test("maps RPC validation error code 22023 to 400", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ cursor: "bad" }),
    createDeps({
      listOpportunities: async () => ({
        data: null,
        error: { code: "22023", message: "unexpected sql error" },
      }),
    }),
  );

  assertEquals(response.status, 400);
});

Deno.test("maps invalid feed cursor RPC message to 400", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest({ cursor: "bad" }),
    createDeps({
      listOpportunities: async () => ({
        data: null,
        error: { message: "invalid feed cursor payload" },
      }),
    }),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "invalid feed cursor payload");
});

Deno.test("maps generic RPC failure to 500", async () => {
  const response = await handleListProviderOpportunitiesRequest(
    authedRequest(),
    createDeps({
      listOpportunities: async () => ({
        data: null,
        error: { code: "XX000", message: "database unavailable" },
      }),
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "Failed to fetch opportunities");
});
