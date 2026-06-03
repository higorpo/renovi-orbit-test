const DEFAULT_IMAGE_PREVIEWS = new Set(["foto", "📷 foto", "mensagem"]);

export function getChatImagePathsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.paths;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
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
