import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../_shared/logger.ts";
import { validateMagicBytes } from "../create-request-quote-order/fileSignatures.ts";
import {
  ALLOWED_PHOTO_TYPES,
  CHAT_MEDIA_BUCKET,
  EXT_BY_TYPE,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from "./constants.ts";

const logger = createLogger("chat-upload-media.upload");

export type UploadChatMediaResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string; status: number };

export async function uploadChatMedia(
  supabase: SupabaseClient,
  storagePathPrefix: string,
  files: File[],
  logContext: Record<string, string | undefined> = {},
): Promise<UploadChatMediaResult> {
  if (files.length > MAX_IMAGES) {
    return {
      ok: false,
      error: `Maximum of ${MAX_IMAGES} images allowed.`,
      status: 400,
    };
  }

  const paths: string[] = [];
  const ts = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `Image ${i + 1} exceeds the maximum allowed size.`,
        status: 400,
      };
    }

    const type = file.type?.toLowerCase() || "";
    if (!ALLOWED_PHOTO_TYPES.includes(type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
      return {
        ok: false,
        error: `Image ${i + 1}: type not allowed. Use JPEG, PNG, WebP, HEIC, or HEIF.`,
        status: 400,
      };
    }

    const contentMatches = await validateMagicBytes(file, type);
    if (!contentMatches) {
      return {
        ok: false,
        error: `Image ${i + 1}: file content does not match declared type.`,
        status: 400,
      };
    }

    const ext = EXT_BY_TYPE[type] ?? "jpg";
    const path = `${storagePathPrefix}${ts}_${i}.${ext}`;

    const { error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      logger.error("storage_upload_failed", {
        ...logContext,
        event_type: "storage_upload_failed",
        storage_path: path,
        error: error.message,
      });
      return {
        ok: false,
        error: "Failed to upload images. Please try again.",
        status: 500,
      };
    }

    paths.push(path);
  }

  return { ok: true, paths };
}
