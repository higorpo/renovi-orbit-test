const DEFAULT_IMAGE_PREVIEWS = new Set(["foto", "📷 foto", "mensagem"]);

export function getChatImagePathsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.paths;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/** Client-only blob URLs shown while upload/send is still in flight. */
export function getLocalPreviewUrlsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.local_preview_urls;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/** Payload accepted by cns_send_message for IMAGE — no client-only fields. */
export function buildImageMessageSendPayload(params: {
  uploadSessionId: string;
  paths: string[];
  preview: string;
}): Record<string, unknown> {
  return {
    upload_session_id: params.uploadSessionId,
    paths: params.paths,
    preview: params.preview,
  };
}

export function stripClientOnlyImagePayloadFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { local_preview_urls: _localPreviews, ...serverPayload } = payload;
  return serverPayload;
}

export function getChatImageCaption(payload: Record<string, unknown>): string | null {
  const preview = payload.preview;
  if (typeof preview !== "string") return null;

  const trimmed = preview.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  if (DEFAULT_IMAGE_PREVIEWS.has(normalized)) return null;
  if (/^\d+\s+fotos?$/.test(normalized)) return null;

  return trimmed;
}
