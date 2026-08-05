/**
 * Parse PostgREST RPC error `details` JSON when present.
 */

export function parseRpcDetailObject(
  details: string | undefined,
): Record<string, unknown> | null {
  if (!details) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function extractRpcErrorCode(error: {
  message: string;
  details?: string;
}): string {
  const detail = parseRpcDetailObject(error.details);
  if (typeof detail?.code === "string") {
    return detail.code;
  }
  return error.message;
}
