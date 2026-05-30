/** chat-upload-media Edge Function constants (design §5.2, task 54). */

export const CHAT_MEDIA_BUCKET = "chat-media";
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const RATE_LIMIT_PER_MINUTE = 30;
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
