// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolioImages } from "../usePortfolioImages";
import type { ProviderPortfolioItemPublic } from "../../types/providerProfilePublic.types";

const getPortfolioImageSignedUrlMock = vi.fn();

vi.mock("../../api/profileImagePublic.api", () => ({
  getPortfolioImageSignedUrl: (...args: unknown[]) =>
    getPortfolioImageSignedUrlMock(...args),
}));

function makeItem(
  overrides: Partial<ProviderPortfolioItemPublic> = {},
): ProviderPortfolioItemPublic {
  return {
    id: "item-1",
    title: "Work",
    description: null,
    service_id: null,
    execution_date: null,
    image_paths: ["img1.jpg"],
    city_region: null,
    sort_order: 0,
    ...overrides,
  };
}

describe("usePortfolioImages", () => {
  beforeEach(() => {
    getPortfolioImageSignedUrlMock.mockReset();
  });

  it("returns empty map for empty items", () => {
    const { result } = renderHook(() => usePortfolioImages([]));
    expect(result.current.imageMap).toEqual({});
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty map when items have no image paths", () => {
    const items = [makeItem({ image_paths: [] })];
    const { result } = renderHook(() => usePortfolioImages(items));
    expect(result.current.imageMap).toEqual({});
    expect(result.current.isLoading).toBe(false);
  });

  it("loads signed URLs for all images", async () => {
    getPortfolioImageSignedUrlMock
      .mockResolvedValueOnce("https://cdn.com/img1.jpg")
      .mockResolvedValueOnce("https://cdn.com/img2.jpg");

    const items = [
      makeItem({
        id: "item-1",
        image_paths: ["img1.jpg", "img2.jpg"],
      }),
    ];

    const { result } = renderHook(() => usePortfolioImages(items));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageMap["item-1"]).toEqual([
      "https://cdn.com/img1.jpg",
      "https://cdn.com/img2.jpg",
    ]);
  });

  it("maps images to correct item IDs", async () => {
    getPortfolioImageSignedUrlMock
      .mockResolvedValueOnce("https://cdn.com/a.jpg")
      .mockResolvedValueOnce("https://cdn.com/b.jpg");

    const items = [
      makeItem({ id: "item-a", image_paths: ["a.jpg"] }),
      makeItem({ id: "item-b", image_paths: ["b.jpg"] }),
    ];

    const { result } = renderHook(() => usePortfolioImages(items));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageMap["item-a"]).toEqual([
      "https://cdn.com/a.jpg",
    ]);
    expect(result.current.imageMap["item-b"]).toEqual([
      "https://cdn.com/b.jpg",
    ]);
  });

  it("excludes empty signed URLs from the map", async () => {
    getPortfolioImageSignedUrlMock
      .mockResolvedValueOnce("https://cdn.com/ok.jpg")
      .mockResolvedValueOnce("");

    const items = [
      makeItem({ id: "item-1", image_paths: ["ok.jpg", "fail.jpg"] }),
    ];

    const { result } = renderHook(() => usePortfolioImages(items));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageMap["item-1"]).toEqual([
      "https://cdn.com/ok.jpg",
    ]);
  });
});
