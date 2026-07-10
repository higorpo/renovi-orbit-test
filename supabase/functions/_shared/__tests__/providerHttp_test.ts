import { assertEquals, assertRejects } from "std/testing/asserts";
import { fetchWithTimeout, PROVIDER_HTTP_TIMEOUT_MS } from "../providerHttp.ts";

Deno.test("PROVIDER_HTTP_TIMEOUT_MS is 25s below 30s lease", () => {
  assertEquals(PROVIDER_HTTP_TIMEOUT_MS, 25_000);
});

Deno.test("fetchWithTimeout aborts when fetch exceeds timeout", async () => {
  const mockFetch: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal = (init as { signal?: AbortSignal })?.signal;
      signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  await assertRejects(
    () => fetchWithTimeout("https://example.com", {}, { timeoutMs: 20, fetchFn: mockFetch }),
    DOMException,
    "Aborted",
  );
});

Deno.test("fetchWithTimeout returns response when fetch completes in time", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response("ok", { status: 200 });

  const response = await fetchWithTimeout(
    "https://example.com",
    { method: "GET" },
    { timeoutMs: 5_000, fetchFn: mockFetch },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
});

Deno.test("fetchWithTimeout uses default timeout and global fetch when options omitted", async () => {
  const originalFetch = globalThis.fetch;
  let seenSignal: AbortSignal | undefined;
  globalThis.fetch = (async (_input, init) => {
    seenSignal = (init as { signal?: AbortSignal })?.signal;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    const response = await fetchWithTimeout("https://example.com");
    assertEquals(response.status, 200);
    assertEquals(seenSignal instanceof AbortSignal, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
