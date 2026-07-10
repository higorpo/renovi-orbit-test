import { assertEquals, assertRejects } from "std/testing/asserts";
import * as jose from "jose";
import {
  buildFcmV1MessageBody,
  FcmConfigError,
  fcmNotificationCollapseKey,
  fcmSendUrl,
  getFcmAccessToken,
  resetFcmAccessTokenCache,
  sendFcmPush,
  type FcmServiceAccount,
} from "../fcm.ts";

const testServiceAccount: FcmServiceAccount = {
  project_id: "orbit-test",
  client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
};

let realPkcs8Key: string | null = null;

async function realServiceAccount(): Promise<FcmServiceAccount> {
  if (!realPkcs8Key) {
    const { privateKey } = await jose.generateKeyPair("RS256", { extractable: true });
    realPkcs8Key = await jose.exportPKCS8(privateKey);
  }
  return {
    project_id: "orbit-test",
    client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
    private_key: realPkcs8Key.replace(/\n/g, "\\n"),
  };
}

Deno.test("fcmNotificationCollapseKey prefers chat id over correlation id", () => {
  assertEquals(
    fcmNotificationCollapseKey({
      fcmTokenSnapshot: "t",
      title: "T",
      body: "B",
      correlationId: "corr-1",
      deliveryId: "del",
      dispatchId: "dispatch",
      chatId: "chat-uuid-1",
    }),
    "chat-uuid-1",
  );
  assertEquals(
    fcmNotificationCollapseKey({
      fcmTokenSnapshot: "t",
      title: "T",
      body: "B",
      correlationId: "corr-only",
      deliveryId: "del",
      dispatchId: "dispatch",
    }),
    "corr-only",
  );
});

Deno.test("buildFcmV1MessageBody sets collapse id and uses token snapshot", () => {
  const body = buildFcmV1MessageBody({
    fcmTokenSnapshot: "fcm-snapshot-token",
    title: "Headline",
    body: "Body text",
    correlationId: "550e8400-e29b-41d4-a716-446655440000",
    deliveryId: "delivery-1",
    dispatchId: "dispatch-abc-123",
    chatId: "chat-uuid-1",
  });

  assertEquals(body.message.token, "fcm-snapshot-token");
  assertEquals(body.message.android.notification.tag, "chat-uuid-1");
  assertEquals(
    body.message.apns.headers["apns-collapse-id"],
    "chat-uuid-1",
  );
  assertEquals(body.message.data.dispatch_id, "dispatch-abc-123");
  assertEquals(body.message.data.correlation_id, "550e8400-e29b-41d4-a716-446655440000");
  assertEquals(body.message.data.chat_id, "chat-uuid-1");
});

Deno.test("buildFcmV1MessageBody omits chat_id when not provided", () => {
  const body = buildFcmV1MessageBody({
    fcmTokenSnapshot: "token",
    title: "T",
    body: "B",
    correlationId: "corr",
    deliveryId: "del",
    dispatchId: "dispatch",
  });

  assertEquals("chat_id" in body.message.data, false);
});

Deno.test("fcmSendUrl targets FCM v1 messages endpoint", () => {
  assertEquals(
    fcmSendUrl("my-project"),
    "https://fcm.googleapis.com/v1/projects/my-project/messages:send",
  );
});

Deno.test("sendFcmPush sends one FCM HTTP v1 request per delivery", async () => {
  resetFcmAccessTokenCache();
  let call = 0;

  const mockFetch: typeof fetch = async (input) => {
    call += 1;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assertEquals(url, fcmSendUrl("orbit-test"));

    return new Response(
      JSON.stringify({ name: "projects/p/messages/msg_123" }),
      { status: 200 },
    );
  };

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "device-fcm-token",
      title: "Hi",
      body: "There",
      correlationId: "corr-abc",
      deliveryId: "del-1",
      dispatchId: "dispatch-xyz",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: testServiceAccount,
      accessToken: "ya29.mock",
      timeoutMs: 5000,
    },
  );

  assertEquals(call, 1);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.vendorMessageId, "projects/p/messages/msg_123");
  }
});

Deno.test("buildFcmV1MessageBody includes deep_link_path when provided", () => {
  const body = buildFcmV1MessageBody({
    fcmTokenSnapshot: "token",
    title: "T",
    body: "B",
    correlationId: "corr",
    deliveryId: "del",
    dispatchId: "dispatch",
    deepLinkPath: "/dashboard/chats/1",
  });
  assertEquals(body.message.data.deep_link_path, "/dashboard/chats/1");
});

Deno.test("buildFcmV1MessageBody rejects blank token snapshot", () => {
  let thrown = false;
  try {
    buildFcmV1MessageBody({
      fcmTokenSnapshot: "   ",
      title: "T",
      body: "B",
      correlationId: "corr",
      deliveryId: "del",
      dispatchId: "dispatch",
    });
  } catch {
    thrown = true;
  }
  assertEquals(thrown, true);
});

Deno.test("getFcmAccessToken fetches OAuth token and reuses cache", async () => {
  resetFcmAccessTokenCache();
  const sa = await realServiceAccount();
  let oauthCalls = 0;

  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("oauth2.googleapis.com/token")) {
      oauthCalls += 1;
      return new Response(
        JSON.stringify({ access_token: "ya29.cached", expires_in: 3600 }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const first = await getFcmAccessToken(sa, { fetchFn: mockFetch });
  const second = await getFcmAccessToken(sa, { fetchFn: mockFetch });

  assertEquals(first, "ya29.cached");
  assertEquals(second, "ya29.cached");
  assertEquals(oauthCalls, 1);
});

Deno.test("getFcmAccessToken defaults expires_in when omitted", async () => {
  resetFcmAccessTokenCache();
  const sa = await realServiceAccount();

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ access_token: "ya29.no-expiry" }), { status: 200 });

  const token = await getFcmAccessToken(sa, { fetchFn: mockFetch });
  assertEquals(token, "ya29.no-expiry");
});

Deno.test("getFcmAccessToken throws FcmConfigError when OAuth response lacks access_token", async () => {
  resetFcmAccessTokenCache();
  const sa = await realServiceAccount();

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });

  await assertRejects(
    () => getFcmAccessToken(sa, { fetchFn: mockFetch }),
    FcmConfigError,
    "invalid_grant",
  );
});

Deno.test("getFcmAccessToken throws default message when OAuth fails without error field", async () => {
  resetFcmAccessTokenCache();
  const sa = await realServiceAccount();

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({}), { status: 500 });

  await assertRejects(
    () => getFcmAccessToken(sa, { fetchFn: mockFetch }),
    FcmConfigError,
    "FCM OAuth token request failed",
  );
});

Deno.test("sendFcmPush obtains access token via OAuth when accessToken is omitted", async () => {
  resetFcmAccessTokenCache();
  const sa = await realServiceAccount();
  let sawOauth = false;
  let sawSend = false;

  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("oauth2.googleapis.com/token")) {
      sawOauth = true;
      return new Response(
        JSON.stringify({ access_token: "ya29.from-oauth", expires_in: 3600 }),
        { status: 200 },
      );
    }
    if (url.includes("fcm.googleapis.com")) {
      sawSend = true;
      return new Response(
        JSON.stringify({ name: "projects/p/messages/via-oauth" }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "device-token",
      title: "Hi",
      body: "Body",
      correlationId: "corr-oauth",
      deliveryId: "del-oauth",
      dispatchId: "dispatch-oauth",
    },
    { fetchFn: mockFetch, serviceAccount: sa, timeoutMs: 5000 },
  );

  assertEquals(sawOauth, true);
  assertEquals(sawSend, true);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.vendorMessageId, "projects/p/messages/via-oauth");
  }
});

Deno.test("sendFcmPush defaults error fields when FCM error payload is empty", async () => {
  resetFcmAccessTokenCache();

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({}), { status: 503 });

  const result = await sendFcmPush(
    {
      fcmTokenSnapshot: "token",
      title: "T",
      body: "B",
      correlationId: "corr-empty",
      deliveryId: "del-empty",
      dispatchId: "dispatch-empty",
    },
    {
      fetchFn: mockFetch,
      serviceAccount: testServiceAccount,
      accessToken: "ya29.mock",
      timeoutMs: 5000,
    },
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.errorCode, "fcm_send_failed");
    assertEquals(result.errorMessage, "FCM HTTP 503");
  }
});

Deno.test("fcmNotificationCollapseKey ignores blank chat id", () => {
  assertEquals(
    fcmNotificationCollapseKey({
      fcmTokenSnapshot: "t",
      title: "T",
      body: "B",
      correlationId: "corr-blank-chat",
      deliveryId: "del",
      dispatchId: "dispatch",
      chatId: "   ",
    }),
    "corr-blank-chat",
  );
});
