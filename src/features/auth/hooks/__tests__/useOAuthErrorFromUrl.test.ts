// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOAuthErrorFromUrl } from "../useOAuthErrorFromUrl";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("useOAuthErrorFromUrl", () => {
  const replaceState = vi.fn();

  beforeEach(() => {
    toastError.mockClear();
    replaceState.mockClear();
    vi.stubGlobal("history", { replaceState });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setUrl(url: string) {
    const parsed = new URL(url, "https://app.example.com");
    vi.stubGlobal("location", {
      href: parsed.href,
      search: parsed.search,
      hash: parsed.hash,
      pathname: parsed.pathname,
    });
  }

  it("does nothing when there is no OAuth error in URL", async () => {
    setUrl("https://app.example.com/login");
    renderHook(() => useOAuthErrorFromUrl());
    await waitFor(() => {
      expect(toastError).not.toHaveBeenCalled();
    });
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("shows toast with description from query and clears URL", async () => {
    setUrl("https://app.example.com/login?error=access_denied&error_description=User%20cancelled");
    renderHook(() => useOAuthErrorFromUrl());
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(toastError).toHaveBeenCalledWith("Erro ao conectar com Google. Tente novamente.");
    expect(replaceState).toHaveBeenCalled();
  });

  it("uses exchange-specific copy when message matches exchange pattern", async () => {
    setUrl("https://app.example.com/cb#error=server_error&error_description=External+code+invalid");
    renderHook(() => useOAuthErrorFromUrl());
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    const arg = toastError.mock.calls[0][1] as { description?: string };
    expect(arg.description).toContain("Google OAuth");
  });

  it("falls back when decodeURIComponent throws on description", async () => {
    const orig = globalThis.decodeURIComponent;
    globalThis.decodeURIComponent = vi.fn(() => {
      throw new URIError("bad");
    }) as typeof decodeURIComponent;
    setUrl("https://app.example.com/login?error=oauth_failed&error_description=%");
    renderHook(() => useOAuthErrorFromUrl());
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastError).toHaveBeenCalledWith("Erro ao conectar com Google. Tente novamente.");
    globalThis.decodeURIComponent = orig;
  });
});
