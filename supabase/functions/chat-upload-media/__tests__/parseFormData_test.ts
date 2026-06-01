import { assertEquals } from "std/testing/asserts";
import { parseFormData } from "../parseFormData.ts";

function jpegFile(name = "a.jpg"): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  return new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], name, {
    type: "image/jpeg",
  });
}

Deno.test("parseFormData rejects missing chat_id", () => {
  const form = new FormData();
  form.append("upload_session_id", "session-1");
  form.append("file", jpegFile());

  const result = parseFormData(form);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assertEquals(result.error, "chat_id is required.");
  }
});

Deno.test("parseFormData rejects missing upload_session_id", () => {
  const form = new FormData();
  form.append("chat_id", "chat-1");
  form.append("file", jpegFile());

  const result = parseFormData(form);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "upload_session_id is required.");
  }
});

Deno.test("parseFormData rejects empty file list", () => {
  const form = new FormData();
  form.append("chat_id", "chat-1");
  form.append("upload_session_id", "session-1");

  const result = parseFormData(form);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "At least one image file is required.");
  }
});

Deno.test("parseFormData accepts file[] fields and optional idempotency_key", () => {
  const form = new FormData();
  form.append("chat_id", "chat-1");
  form.append("upload_session_id", "session-1");
  form.append("idempotency_key", "idem-1");
  form.append("file[]", jpegFile());

  const result = parseFormData(form);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.chatId, "chat-1");
    assertEquals(result.uploadSessionId, "session-1");
    assertEquals(result.idempotencyKey, "idem-1");
    assertEquals(result.files.length, 1);
  }
});
