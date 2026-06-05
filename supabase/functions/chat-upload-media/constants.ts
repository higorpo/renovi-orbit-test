/** chat-upload-media Edge Function constants (design §5.2, task 54). */

export const CHAT_MEDIA_BUCKET = "chat-media";
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_FILES = 1;
/** 128 kbps × 120 s × 15% headroom — keep in sync with chatAudioConstants.ts */
export const MAX_AUDIO_BYTES = 2_208_000;
export const RATE_LIMIT_PER_MINUTE = 30;

export type ChatMediaKind = "image" | "audio";

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/m4a",
] as const;

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
};
