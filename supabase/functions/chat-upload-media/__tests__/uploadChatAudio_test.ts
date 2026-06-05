import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_AUDIO_BYTES } from "../constants.ts";
import { uploadChatMedia } from "../uploadChatMedia.ts";

function webmFile(extraPadding = 0): File {
  const body = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00,
    ...new Array(extraPadding).fill(0),
  ]);
  return new File([body], "voice.webm", { type: "audio/webm;codecs=opus" });
}

function createStorageClient(): SupabaseClient {
  return {
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
      }),
    },
  } as unknown as SupabaseClient;
}

Deno.test("uploadChatMedia rejects more than one audio file", async () => {
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [webmFile(), webmFile(1)],
    {},
    "audio",
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Only one audio file is allowed per upload.");
  }
});

Deno.test("uploadChatMedia rejects oversized audio", async () => {
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [webmFile(MAX_AUDIO_BYTES)],
    {},
    "audio",
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Audio 1 exceeds the maximum allowed size.");
  }
});

Deno.test("uploadChatMedia uploads valid webm audio", async () => {
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [webmFile()],
    {},
    "audio",
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.paths.length, 1);
    assertEquals(result.paths[0]?.endsWith(".webm"), true);
  }
});

Deno.test("uploadChatMedia rejects invalid audio mime", async () => {
  const file = new File([webmFile()], "voice.mp3", { type: "audio/mpeg" });
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [file],
    {},
    "audio",
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      "Audio 1: type not allowed. Use WebM, OGG, AAC, or M4A.",
    );
  }
});
