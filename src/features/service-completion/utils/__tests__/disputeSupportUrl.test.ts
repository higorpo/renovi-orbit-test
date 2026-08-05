// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveDisputeSupportUrl,
  openExternalSupportUrl,
} from "../disputeSupportUrl";

describe("resolveDisputeSupportUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { __ORBIT_REMOTE_CONFIG__?: unknown }).__ORBIT_REMOTE_CONFIG__;
  });

  it("returns null when unset", () => {
    vi.stubEnv("VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL", "");
    expect(resolveDisputeSupportUrl(null)).toBeNull();
  });

  it("accepts explicit override URL", () => {
    expect(
      resolveDisputeSupportUrl("https://support.renovi.example/dispute"),
    ).toBe("https://support.renovi.example/dispute");
  });

  it("prefers explicit override over remote config", () => {
    (window as { __ORBIT_REMOTE_CONFIG__?: Record<string, string> }).__ORBIT_REMOTE_CONFIG__ =
      {
        "orbit.dispute_support_url": "https://remote.example/d",
      };
    expect(resolveDisputeSupportUrl("https://override.example/d")).toBe(
      "https://override.example/d",
    );
  });

  it("reads remote config when no override", () => {
    (window as { __ORBIT_REMOTE_CONFIG__?: Record<string, string> }).__ORBIT_REMOTE_CONFIG__ =
      {
        "orbit.dispute_support_url": "https://remote.example/d",
      };
    expect(resolveDisputeSupportUrl()).toBe("https://remote.example/d");
  });

  it("rejects non-http protocols", () => {
    expect(resolveDisputeSupportUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("openExternalSupportUrl", () => {
  it("opens in a new tab with noopener", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openExternalSupportUrl("https://support.example/");
    expect(open).toHaveBeenCalledWith(
      "https://support.example/",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});
