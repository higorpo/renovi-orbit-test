import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES, MAX_IMAGES } from "../constants.ts";
import { uploadChatMedia } from "../uploadChatMedia.ts";

function jpegFile(extraPadding = 0): File {
  const body = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ...new Array(extraPadding).fill(0),
  ]);
  return new File([body], "photo.jpg", { type: "image/jpeg" });
}

function pngFile(): File {
  const body = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
  ]);
  return new File([body], "photo.png", { type: "image/png" });
}

function spoofedJpegFile(): File {
  return new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "fake.jpg", {
    type: "image/jpeg",
  });
}

function createStorageClient(
  onUpload?: (path: string, file: File) => Promise<{ error: { message: string } | null }>,
): SupabaseClient {
  return {
    storage: {
      from: () => ({
        upload: (path: string, file: File) =>
          onUpload ? onUpload(path, file) : Promise.resolve({ error: null }),
      }),
    },
  } as unknown as SupabaseClient;
}

Deno.test("uploadChatMedia rejects more than MAX_IMAGES files", async () => {
  const files = Array.from({ length: MAX_IMAGES + 1 }, (_, i) =>
    jpegFile(i)
  );
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    files,
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assertEquals(result.error, `Maximum of ${MAX_IMAGES} images allowed.`);
  }
});

Deno.test("uploadChatMedia rejects files exceeding MAX_IMAGE_BYTES", async () => {
  const oversized = jpegFile(MAX_IMAGE_BYTES);
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [oversized],
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assertEquals(result.error, "Image 1 exceeds the maximum allowed size.");
  }
});

Deno.test("uploadChatMedia rejects disallowed MIME type", async () => {
  const file = new File([jpegFile()], "doc.pdf", { type: "application/pdf" });
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [file],
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assertEquals(
      result.error,
      "Image 1: type not allowed. Use JPEG, PNG, WebP, HEIC, or HEIF.",
    );
  }
});

Deno.test("uploadChatMedia rejects magic bytes that do not match declared type", async () => {
  const result = await uploadChatMedia(
    createStorageClient(),
    "chat-1/session-1/",
    [spoofedJpegFile()],
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 400);
    assertEquals(result.error, "Image 1: file content does not match declared type.");
  }
});

Deno.test("uploadChatMedia uploads valid JPEG and PNG with storage paths", async () => {
  const uploaded: Array<{ path: string; type: string }> = [];

  const client = createStorageClient(async (path, file) => {
    uploaded.push({ path, type: file.type });
    return { error: null };
  });

  const result = await uploadChatMedia(client, "chat-1/session-1/", [
    jpegFile(),
    pngFile(),
  ]);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.paths.length, 2);
    assertEquals(uploaded.length, 2);
    assertEquals(uploaded[0]?.type, "image/jpeg");
    assertEquals(uploaded[1]?.type, "image/png");
    assertEquals(result.paths[0]?.endsWith(".jpg"), true);
    assertEquals(result.paths[1]?.endsWith(".png"), true);
  }
});

Deno.test("uploadChatMedia surfaces storage upload failures", async () => {
  const client = createStorageClient(async () => ({
    error: { message: "bucket unavailable" },
  }));

  const result = await uploadChatMedia(client, "chat-1/session-1/", [jpegFile()]);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 500);
    assertEquals(result.error, "Failed to upload images. Please try again.");
  }
});
