import { assertEquals } from "std/testing/asserts";
import {
  buildFcmV1MessageBody,
  fcmSendUrl,
  resetFcmAccessTokenCache,
  sendFcmPush,
  type FcmServiceAccount,
} from "../fcm.ts";

const testServiceAccount: FcmServiceAccount = {
  project_id: "orbit-test",
  client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
};

Deno.test("buildFcmV1MessageBody sets collapse id and uses token snapshot", () => {
  const body = buildFcmV1MessageBody({
    fcmTokenSnapshot: "fcm-snapshot-token",
    title: "Headline",
    body: "Body text",
    correlationId: "550e8400-e29b-41d4-a716-446655440000",
    deliveryId: "delivery-1",
  });

  assertEquals(body.message.token, "fcm-snapshot-token");
  assertEquals(body.message.android.notification.tag, "550e8400-e29b-41d4-a716-446655440000");
  assertEquals(
    body.message.apns.headers["apns-collapse-id"],
    "550e8400-e29b-41d4-a716-446655440000",
  );
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
