import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import { useShareProfile } from "../useShareProfile";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

function makeProfile(
  overrides: Partial<ProviderPublicProfile> = {},
): ProviderPublicProfile {
  return {
    provider_id: "p1",
    slug: "joao-silva",
    display_name: "João Silva",
    bio: null,
    profile_visibility: "public",
    service_area_cities: null,
    service_area_regions: null,
    service_area_neighborhoods: null,
    full_name: "João Silva",
    profile_image_path: null,
    created_at: "2024-01-01T00:00:00Z",
    offered_services: [],
    portfolio_items: [],
    ...overrides,
  };
}

describe("useShareProfile", () => {
  const originalNavigator = { ...navigator };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.success).mockClear();
    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator },
      writable: true,
      configurable: true,
    });
  });

  it("returns profileUrl based on slug", () => {
    const { result } = renderHook(() => useShareProfile(makeProfile()));
    expect(result.current.profileUrl).toContain("/perfil/joao-silva");
  });

  it("uses Web Share API when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useShareProfile(makeProfile()));

    await act(async () => {
      await result.current.share();
    });

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "João Silva | Renovi",
        url: expect.stringContaining("/perfil/joao-silva"),
      }),
    );
  });

  it("falls back to clipboard when Web Share rejects", async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error("User cancelled"));
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useShareProfile(makeProfile()));

    await act(async () => {
      await result.current.share();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/perfil/joao-silva"),
    );
    expect(toast.success).toHaveBeenCalledWith("Link copiado!", expect.any(Object));
  });

  it("uses clipboard when Web Share is not available", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useShareProfile(makeProfile()));

    await act(async () => {
      await result.current.share();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/perfil/joao-silva"),
    );
    expect(toast.success).toHaveBeenCalledWith("Link copiado!", expect.any(Object));
  });

  it("uses full_name when display_name is empty", () => {
    const profile = makeProfile({
      display_name: null,
      full_name: "Maria Souza",
    });
    const { result } = renderHook(() => useShareProfile(profile));
    expect(result.current.profileUrl).toContain("/perfil/joao-silva");
  });
});
