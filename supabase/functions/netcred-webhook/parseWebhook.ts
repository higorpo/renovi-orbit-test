export async function digestSha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parseWebhookPayload(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Persist unparsed payloads for audit; downstream handlers treat as empty object.
  }

  return { _unparsed: true };
}

export async function extractProviderEventId(
  rawBody: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const candidates = [
    payload.id,
    payload.eventId,
    payload.event_id,
    (payload.data as Record<string, unknown> | undefined)?.id,
    (payload.transaction as Record<string, unknown> | undefined)?.id,
    (payload.charge as Record<string, unknown> | undefined)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return digestSha256Hex(rawBody);
}
