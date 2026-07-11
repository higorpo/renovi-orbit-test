import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIpBestEffort } from "../getClientIp";

describe("getClientIpBestEffort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the IP address from a successful response", async () => {
    const signal = new AbortController().signal;
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ip: "203.0.113.10" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getClientIpBestEffort()).resolves.toBe("203.0.113.10");
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3_000);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ipify.org?format=json",
      { signal },
    );
  });

  it("returns null when the response is not successful", async () => {
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json }),
    );

    await expect(getClientIpBestEffort()).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["not a string", { ip: 123 }],
  ])("returns null when the IP is %s", async (_description, payload) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(payload),
      }),
    );

    await expect(getClientIpBestEffort()).resolves.toBeNull();
  });

  it("returns null when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(getClientIpBestEffort()).resolves.toBeNull();
  });
});
