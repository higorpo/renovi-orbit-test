/** Path helpers for completion-evidence Storage (KYC-style client upload). */

const SAFE_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;

export const COMPLETION_EVIDENCE_BUCKET = "completion-evidence";

export function evidenceFileExtension(filename: string, mimeType?: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if ((SAFE_EXT as readonly string[]).includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

/** `{storage_prefix}{uuid}.{ext}` — prefix already includes trailing slash from RPC. */
export function completionEvidenceObjectPath(
  storagePrefix: string,
  filename: string,
  mimeType?: string,
  objectId: string = crypto.randomUUID(),
): string {
  const prefix = storagePrefix.endsWith("/")
    ? storagePrefix
    : `${storagePrefix}/`;
  const ext = evidenceFileExtension(filename, mimeType);
  return `${prefix}${objectId}.${ext}`;
}
