import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MIN_AUDIO_DURATION_MS,
} from "./chatAudioConstants";

const ALLOWED_AUDIO_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
];

const AUDIO_EXTENSION_MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
};

const UNTRUSTED_AUDIO_MIME_PREFIXES = [
  "application/octet-stream",
  "binary/octet-stream",
];

function extractFileExtension(fileNameOrPath: string): string {
  const sanitized = fileNameOrPath.split(/[?#]/)[0] ?? "";
  const segment = sanitized.split("/").pop() ?? sanitized;
  const dot = segment.lastIndexOf(".");
  if (dot === -1) return "";
  return segment.slice(dot + 1).toLowerCase();
}

function isUntrustedAudioMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!normalized) return true;
  return UNTRUSTED_AUDIO_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isAllowedChatAudioMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return ALLOWED_AUDIO_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Native Android/iOS often report generic octet-stream; infer from file path when needed. */
export function resolveChatAudioMimeType(
  declaredMime: string,
  fileNameOrPath?: string,
): string {
  const normalized = declaredMime.toLowerCase().split(";")[0]?.trim() ?? "";

  if (!isUntrustedAudioMimeType(normalized) && isAllowedChatAudioMimeType(normalized)) {
    return normalized;
  }

  const fromExtension = AUDIO_EXTENSION_MIME[extractFileExtension(fileNameOrPath ?? "")];
  if (fromExtension) return fromExtension;

  if (normalized && isAllowedChatAudioMimeType(normalized)) {
    return normalized;
  }

  return "audio/mp4";
}

export function validateChatAudioFile(file: File, durationMs: number): string | null {
  const mimeType = resolveChatAudioMimeType(file.type, file.name);
  if (!isAllowedChatAudioMimeType(mimeType)) {
    return "Formato de áudio não suportado.";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return "O áudio é grande demais. Grave uma mensagem mais curta.";
  }

  if (durationMs < MIN_AUDIO_DURATION_MS) {
    return "Grave pelo menos 1 segundo de áudio.";
  }

  if (durationMs > MAX_AUDIO_DURATION_MS) {
    return "O áudio pode ter no máximo 2 minutos.";
  }

  return null;
}
