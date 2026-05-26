import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  FcmConfigError,
  fcmSendUrl,
  parseFcmServiceAccount,
  resetFcmAccessTokenCache,
  sendFcmPush,
} from "../fcm.ts";

// --- parseFcmServiceAccount ---

Deno.test("parseFcmServiceAccount throws when env var is empty", () => {
  Deno.env.delete("FCM_SERVICE_ACCOUNT");
  assertThrows(
    () => parseFcmServiceAccount(undefined),
    FcmConfigError,
    "FCM_SERVICE_ACCOUNT is required",
  );
});

Deno.test("parseFcmServiceAccount throws when JSON is incomplete", () => {
  assertThrows(
    () => parseFcmServiceAccount(JSON.stringify({ project_id: "p" })),
    FcmConfigError,
    "FCM_SERVICE_ACCOUNT JSON is incomplete",
  );
});

Deno.test("parseFcmServiceAccount parses valid JSON", () => {
  const sa = parseFcmServiceAccount(JSON.stringify({
    project_id: "orbit-prod",
    client_email: "firebase@test.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n",
  }));
  assertEquals(sa.project_id, "orbit-prod");
  assertEquals(sa.client_email, "firebase@test.iam.gserviceaccount.com");
});

// --- sendFcmPush failure paths ---

Deno.test("sendFcmPush maps 401 as non-retryable failure", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: "Invalid OAuth token", status: "UNAUTHENTICATED" } }),
      { status: 401 },
    );

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "token-ok",
      title: "Hi",
      body: "Body",
      correlationId: "corr-401",
      deliveryId: "del-401",
      dispatchId: "dispatch-401",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: {
        project_id: "test",
        client_email: "sa@test.iam.gserviceaccount.com",
        private_key: "key",
      },
      accessToken: "ya29.expired",
      timeoutMs: 5000,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 401);
    assertEquals(result.errorCode, "UNAUTHENTICATED");
  }
});

Deno.test("sendFcmPush maps 404 NOT_FOUND as invalid token failure", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: "Requested entity was not found", status: "NOT_FOUND" } }),
      { status: 404 },
    );

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "stale-token",
      title: "Hi",
      body: "Body",
      correlationId: "corr-404",
      deliveryId: "del-404",
      dispatchId: "dispatch-404",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: {
        project_id: "test",
        client_email: "sa@test.iam.gserviceaccount.com",
        private_key: "key",
      },
      accessToken: "ya29.mock",
      timeoutMs: 5000,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 404);
    assertEquals(result.errorCode, "NOT_FOUND");
  }
});

Deno.test("sendFcmPush maps timeout (AbortError) as fcm_timeout", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () => {
    throw new DOMException("The operation was aborted", "AbortError");
  };

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "token-ok",
      title: "Hi",
      body: "Body",
      correlationId: "corr-timeout",
      deliveryId: "del-timeout",
      dispatchId: "dispatch-timeout",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: {
        project_id: "test",
        client_email: "sa@test.iam.gserviceaccount.com",
        private_key: "key",
      },
      accessToken: "ya29.mock",
      timeoutMs: 100,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 0);
    assertEquals(result.errorCode, "fcm_timeout");
  }
});

Deno.test("sendFcmPush maps generic network error to fcm_request_failed", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () => {
    throw new Error("DNS resolution failed");
  };

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "token-ok",
      title: "Hi",
      body: "Body",
      correlationId: "corr-dns",
      deliveryId: "del-dns",
      dispatchId: "dispatch-dns",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: {
        project_id: "test",
        client_email: "sa@test.iam.gserviceaccount.com",
        private_key: "key",
      },
      accessToken: "ya29.mock",
      timeoutMs: 5000,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 0);
    assertEquals(result.errorCode, "fcm_request_failed");
    assertEquals(result.errorMessage, "DNS resolution failed");
  }
});

Deno.test("sendFcmPush handles 429 rate limiting response", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: "Rate limit exceeded", status: "RESOURCE_EXHAUSTED" } }),
      { status: 429 },
    );

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "token-ok",
      title: "Hi",
      body: "Body",
      correlationId: "corr-429",
      deliveryId: "del-429",
      dispatchId: "dispatch-429",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: {
        project_id: "test",
        client_email: "sa@test.iam.gserviceaccount.com",
        private_key: "key",
      },
      accessToken: "ya29.mock",
      timeoutMs: 5000,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 429);
    assertEquals(result.errorCode, "RESOURCE_EXHAUSTED");
  }
});
