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
