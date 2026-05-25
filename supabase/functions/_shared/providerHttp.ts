/**
 * Provider HTTP timeout — below 30s checkout lease (design §4.4, task 60, Req.3 AC2).
 */
export const PROVIDER_HTTP_TIMEOUT_MS = 25_000;

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  options?: { timeoutMs?: number; fetchFn?: typeof fetch },
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? PROVIDER_HTTP_TIMEOUT_MS;
  const fetchFn = options?.fetchFn ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
