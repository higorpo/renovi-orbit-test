import { assertEquals } from "std/testing/asserts";
import { buildUploadLogContext } from "../buildUploadLogContext.ts";

Deno.test("buildUploadLogContext includes required observability fields", () => {
  const context = buildUploadLogContext({
    correlationId: "corr-1",
    conversationId: "chat-1",
    uploadSessionId: "session-1",
    idempotencyKey: "key-1",
    eventType: "upload_started",
  });

  assertEquals(context, {
    correlation_id: "corr-1",
    conversation_id: "chat-1",
    upload_session_id: "session-1",
    idempotency_key: "key-1",
    event_type: "upload_started",
  });
});

Deno.test("buildUploadLogContext omits optional fields when absent", () => {
  const context = buildUploadLogContext({
    correlationId: "corr-2",
  });

  assertEquals(context, {
    correlation_id: "corr-2",
  });
});
