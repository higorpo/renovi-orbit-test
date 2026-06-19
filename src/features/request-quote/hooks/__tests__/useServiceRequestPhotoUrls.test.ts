// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useServiceRequestPhotoUrls } from "../useServiceRequestPhotoUrls";

const getServiceRequestPhotoDisplayUrl = vi.fn();
const isStoragePath = vi.fn();

vi.mock("../../api/serviceRequestPhotoStorage.api", () => ({
  getServiceRequestPhotoDisplayUrl: (...args: unknown[]) =>
    getServiceRequestPhotoDisplayUrl(...args),
}));

vi.mock("../../utils/serviceRequestPhotos", () => ({
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
    expect(getServiceRequestPhotoDisplayUrl).not.toHaveBeenCalled();
  });

  it("returns empty urls when photos is empty array", async () => {
    const { result } = renderHook(() => useServiceRequestPhotoUrls([]));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.urls).toEqual([]);
  });

  it("resolves storage paths via getServiceRequestPhotoDisplayUrl", async () => {
    isStoragePath.mockReturnValueOnce(true);
    getServiceRequestPhotoDisplayUrl.mockResolvedValue("https://signed.example/x");

    const { result } = renderHook(() => useServiceRequestPhotoUrls(["path/to/photo.jpg"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getServiceRequestPhotoDisplayUrl).toHaveBeenCalledWith("path/to/photo.jpg");
    expect(result.current.urls).toEqual(["https://signed.example/x"]);
  });

  it("filters out empty resolved URLs", async () => {
    isStoragePath.mockReturnValueOnce(true);
    getServiceRequestPhotoDisplayUrl.mockResolvedValue("");

    const { result } = renderHook(() => useServiceRequestPhotoUrls(["path.jpg"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual([]);
  });

  it("passes legacy URLs through without calling storage API", async () => {
    isStoragePath.mockReturnValueOnce(false);

    const { result } = renderHook(() =>
      useServiceRequestPhotoUrls(["https://cdn.example.com/legacy.jpg"])
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getServiceRequestPhotoDisplayUrl).not.toHaveBeenCalled();
    expect(result.current.urls).toEqual(["https://cdn.example.com/legacy.jpg"]);
  });

  it("ignores stale results when photos change before resolution", async () => {
    isStoragePath.mockReturnValue(true);
    let resolveFirst: (value: string) => void;
    const firstPromise = new Promise<string>((r) => {
      resolveFirst = r;
    });
    getServiceRequestPhotoDisplayUrl.mockReturnValue(firstPromise);

    const { result, rerender } = renderHook(
      ({ photos }: { photos: string[] | null }) => useServiceRequestPhotoUrls(photos),
      { initialProps: { photos: ["a.jpg"] } as { photos: string[] | null } }
    );

    rerender({ photos: null });
    resolveFirst!("https://stale.url");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual([]);
  });
});
