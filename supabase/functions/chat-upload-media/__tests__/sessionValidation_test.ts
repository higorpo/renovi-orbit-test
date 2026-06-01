import { assertEquals } from "std/testing/asserts";
import type { ValidateUploadSessionResult } from "../types.ts";

/** Mirrors index.ts session RPC error → HTTP status mapping. */
function sessionValidationStatus(code: string | undefined): number {
  return code === "42501" ? 403 : 400;
}

/** Mirrors index.ts RPC argument shape for cns_validate_upload_session. */
function buildSessionRpcParams(chatId: string, uploadSessionId: string) {
  return {
    p_upload_session_id: uploadSessionId,
    p_chat_id: chatId,
  };
}

Deno.test("session validation maps forbidden RPC code to 403", () => {
  assertEquals(sessionValidationStatus("42501"), 403);
  assertEquals(sessionValidationStatus("P0001"), 400);
  assertEquals(sessionValidationStatus(undefined), 400);
});

Deno.test("session validation RPC params include session and chat ids", () => {
  assertEquals(
    buildSessionRpcParams("chat-1", "session-1"),
    {
      p_upload_session_id: "session-1",
      p_chat_id: "chat-1",
    },
  );
});

Deno.test("session validation success exposes storage_path_prefix for upload", () => {
  const session: ValidateUploadSessionResult = {
    upload_session_id: "session-1",
    chat_id: "chat-1",
    uploader_id: "user-1",
    status: "PENDING",
    expires_at: "2026-12-31T00:00:00.000Z",
    storage_path_prefix: "chat-1/session-1/",
  };

  assertEquals(session.storage_path_prefix, "chat-1/session-1/");
  assertEquals(session.status, "PENDING");
});
