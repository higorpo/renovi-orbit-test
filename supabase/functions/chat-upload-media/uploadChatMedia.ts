import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../_shared/logger.ts";
import { validateMagicBytes } from "../create-request-quote-order/fileSignatures.ts";
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_PHOTO_TYPES,
  CHAT_MEDIA_BUCKET,
  type ChatMediaKind,
  EXT_BY_TYPE,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_FILES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from "./constants.ts";
import { validateAudioMagicBytes } from "./validateAudioMagicBytes.ts";

const logger = createLogger("chat-upload-media.upload");

export type UploadChatMediaResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string; status: number };

function normalizeMimeType(type: string): string {
  return type?.toLowerCase() || "";
}

function resolveAudioMimeType(type: string): string | null {
  const normalized = normalizeMimeType(type);
  if (ALLOWED_AUDIO_TYPES.includes(normalized as (typeof ALLOWED_AUDIO_TYPES)[number])) {
    return normalized;
  }
  if (normalized.startsWith("audio/webm")) return "audio/webm";
  return null;
}

async function validateFileContent(
  file: File,
  mediaKind: ChatMediaKind,
  mimeType: string,
): Promise<boolean> {
  if (mediaKind === "audio") {
    return validateAudioMagicBytes(file, mimeType);
  }
  return validateMagicBytes(file, mimeType);
}

export async function uploadChatMedia(
  supabase: SupabaseClient,
  storagePathPrefix: string,
  files: File[],
  logContext: Record<string, string | undefined> = {},
  mediaKind: ChatMediaKind = "image",
): Promise<UploadChatMediaResult> {
  const maxFiles = mediaKind === "audio" ? MAX_AUDIO_FILES : MAX_IMAGES;
  const maxBytes = mediaKind === "audio" ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  const label = mediaKind === "audio" ? "Audio" : "Image";

  if (files.length > maxFiles) {
    return {
      ok: false,
      error:
        mediaKind === "audio"
          ? "Only one audio file is allowed per upload."
          : `Maximum of ${MAX_IMAGES} images allowed.`,
      status: 400,
    };
  }

  const paths: string[] = [];
  const ts = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > maxBytes) {
      return {
        ok: false,
        error: `${label} ${i + 1} exceeds the maximum allowed size.`,
        status: 400,
      };
    }

    const rawType = normalizeMimeType(file.type);
    let resolvedType = rawType;

    if (mediaKind === "audio") {
      const audioType = resolveAudioMimeType(rawType);
      if (!audioType) {
        return {
          ok: false,
          error: `${label} ${i + 1}: type not allowed. Use WebM, OGG, AAC, or M4A.`,
          status: 400,
        };
      }
      resolvedType = audioType;
    } else if (
      !ALLOWED_PHOTO_TYPES.includes(rawType as (typeof ALLOWED_PHOTO_TYPES)[number])
    ) {
      return {
        ok: false,
        error: `${label} ${i + 1}: type not allowed. Use JPEG, PNG, WebP, HEIC, or HEIF.`,
        status: 400,
      };
    }

    const contentMatches = await validateFileContent(file, mediaKind, resolvedType);
    if (!contentMatches) {
      return {
        ok: false,
        error: `${label} ${i + 1}: file content does not match declared type.`,
        status: 400,
      };
    }

    const ext = EXT_BY_TYPE[resolvedType] ?? EXT_BY_TYPE[rawType] ?? (mediaKind === "audio" ? "webm" : "jpg");
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
        error:
          mediaKind === "audio"
            ? "Failed to upload audio. Please try again."
            : "Failed to upload images. Please try again.",
        status: 500,
      };
    }

    paths.push(path);
  }

  return { ok: true, paths };
}
