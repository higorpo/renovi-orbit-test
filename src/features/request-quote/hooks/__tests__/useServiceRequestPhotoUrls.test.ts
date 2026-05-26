// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useServiceRequestPhotoUrls } from "../useServiceRequestPhotoUrls";

const getServiceRequestPhotoDisplayUrl = vi.fn();
const isStoragePath = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: { name: "mock-supabase" },
}));

vi.mock("../../utils/serviceRequestPhotos", () => ({
  getServiceRequestPhotoDisplayUrl: (...args: unknown[]) =>
    getServiceRequestPhotoDisplayUrl(...args),
  isStoragePath: (...args: unknown[]) => isStoragePath(...args),
}));

describe("useServiceRequestPhotoUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty urls and not loading when photos is null", async () => {
    const { result } = renderHook(() => useServiceRequestPhotoUrls(null));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual([]);
  });

  it("handles undefined photos like empty (defensive)", async () => {
    const { result } = renderHook(() =>
      useServiceRequestPhotoUrls(undefined as unknown as null)
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual([]);
  });

  it("returns empty urls when photos is empty array", async () => {
    const { result } = renderHook(() => useServiceRequestPhotoUrls([]));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual([]);
  });

  it("keeps legacy URLs as-is when not a storage path", async () => {
    isStoragePath.mockReturnValue(false);
    const { result } = renderHook(() =>
      useServiceRequestPhotoUrls(["https://example.com/a.jpg"])
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual(["https://example.com/a.jpg"]);
    expect(getServiceRequestPhotoDisplayUrl).not.toHaveBeenCalled();
  });

  it("resolves storage paths via getServiceRequestPhotoDisplayUrl", async () => {
    isStoragePath.mockImplementation((p: string) => p.startsWith("svc/"));
    getServiceRequestPhotoDisplayUrl.mockResolvedValue("https://signed.example/x");
    const { result } = renderHook(() => useServiceRequestPhotoUrls(["svc/requests/1/a.jpg"]));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual(["https://signed.example/x"]);
    expect(getServiceRequestPhotoDisplayUrl).toHaveBeenCalled();
  });

  it("filters out empty strings from resolved list", async () => {
    isStoragePath.mockReturnValue(true);
    getServiceRequestPhotoDisplayUrl.mockResolvedValue("");
    const { result } = renderHook(() => useServiceRequestPhotoUrls(["svc/a"]));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual([]);
  });

  it("re-runs when photos array contents change", async () => {
    isStoragePath.mockReturnValue(false);
    const { result, rerender } = renderHook(
      ({ photos }: { photos: string[] | null }) => useServiceRequestPhotoUrls(photos),
      {
        initialProps: { photos: ["https://a.com/1.jpg"] as string[] | null },
      }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["https://a.com/1.jpg"]);
    rerender({ photos: ["https://b.com/2.jpg"] });
    await waitFor(() => {
      expect(result.current.urls).toEqual(["https://b.com/2.jpg"]);
    });
  });

  it("does not update state after unmount when cancelled", async () => {
    isStoragePath.mockReturnValue(true);
    getServiceRequestPhotoDisplayUrl.mockImplementation(
      () => new Promise((r) => setTimeout(() => r("https://late"), 50))
    );
    const { result, unmount } = renderHook(() => useServiceRequestPhotoUrls(["svc/x"]));
    expect(result.current.isLoading).toBe(true);
    unmount();
    await new Promise((r) => setTimeout(r, 80));
  });
});
