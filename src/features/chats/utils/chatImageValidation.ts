/** Client-side limits aligned with chat-upload-media Edge (design §5.2). */

export const CHAT_MAX_IMAGES = 5;
export const CHAT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const CHAT_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type ChatAllowedImageType = (typeof CHAT_ALLOWED_IMAGE_TYPES)[number];

export const CHAT_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

const EXTENSION_TO_MIME: Record<string, ChatAllowedImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Resolves MIME from file.type or extension (many mobile pickers leave type empty). */
export function resolveChatImageMimeType(file: File): ChatAllowedImageType | null {
  const type = file.type?.toLowerCase().trim() ?? "";
  if (CHAT_ALLOWED_IMAGE_TYPES.includes(type as ChatAllowedImageType)) {
    return type as ChatAllowedImageType;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[ext] ?? null;
}

/** Re-wraps file with a declared MIME when the picker omits file.type (required by Edge upload). */
export function normalizeChatImageFile(file: File): File {
  const mime = resolveChatImageMimeType(file);
  if (!mime || file.type?.toLowerCase() === mime) {
    return file;
  }
  return new File([file], file.name || "image.jpg", {
    type: mime,
    lastModified: file.lastModified,
  });
}

export function normalizeChatImageFiles(files: File[]): File[] {
  return files.map(normalizeChatImageFile);
}

export function validateChatImageFile(file: File): string | null {
  if (!resolveChatImageMimeType(file)) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > CHAT_MAX_IMAGE_BYTES) {
    return "Cada imagem deve ter no máximo 5 MB.";
  }
  return null;
}

export function validateChatImageFiles(files: File[]): string | null {
  if (files.length === 0) {
    return "Selecione pelo menos uma imagem.";
  }
  if (files.length > CHAT_MAX_IMAGES) {
    return `Você pode enviar no máximo ${CHAT_MAX_IMAGES} imagens por vez.`;
  }
  for (const file of files) {
    const error = validateChatImageFile(file);
    if (error) return error;
  }
  return null;
}
