import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { usePortfolioItems } from "../usePortfolioItems";
import type { ProviderPortfolioItem } from "../../api/providerProfile.api";

const providerId = "prov-1";

function makePortfolioItem(
  partial: Partial<ProviderPortfolioItem> & Pick<ProviderPortfolioItem, "id" | "title">
): ProviderPortfolioItem {
  return {
    id: partial.id,
    provider_id: partial.provider_id ?? providerId,
    title: partial.title,
    description: partial.description ?? null,
    image_paths: partial.image_paths ?? [],
    sort_order: partial.sort_order ?? 0,
    created_at: partial.created_at ?? "",
    updated_at: partial.updated_at ?? "",
    city_region: partial.city_region ?? null,
    execution_date: partial.execution_date ?? null,
    featured: partial.featured ?? false,
    service_id: partial.service_id ?? null,
    visibility: partial.visibility ?? "public",
  };
}
const mockProfile = { id: providerId, role: "provider" as const };

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/providerProfile.api", () => ({
  listPortfolioItems: vi.fn(),
  createPortfolioItem: vi.fn(),
  updatePortfolioItem: vi.fn(),
  deletePortfolioItem: vi.fn(),
  reorderPortfolioItems: vi.fn(),
}));

vi.mock("../../api/portfolioImageStorage.api", () => ({
  uploadPortfolioImage: vi.fn(),
  removePortfolioImageFromStorage: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const listPortfolioItems = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.listPortfolioItems)
);
const createPortfolioItem = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.createPortfolioItem)
);
const uploadPortfolioImage = vi.mocked(
  await import("../../api/portfolioImageStorage.api").then((m) => m.uploadPortfolioImage)
);
const removePortfolioImageFromStorage = vi.mocked(
  await import("../../api/portfolioImageStorage.api").then(
    (m) => m.removePortfolioImageFromStorage
  )
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("usePortfolioItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      profile: mockProfile,
    } as ReturnType<typeof useAuth>);
    listPortfolioItems.mockResolvedValue({ items: [], error: null });
  });

  describe("query", () => {
    it("returns items and loading state", async () => {
      const items = [
        makePortfolioItem({
          id: "item-1",
          title: "Work",
        }),
      ];
      listPortfolioItems.mockResolvedValue({ items, error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toEqual(items);
      expect(result.current.error).toBeNull();
    });

    it("does not fetch when profile is null", async () => {
      useAuth.mockReturnValue({ profile: null } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(listPortfolioItems).not.toHaveBeenCalled();
    });
  });

  describe("createItemWithImages", () => {
    it("creates item without images and returns data", async () => {
      const created = makePortfolioItem({
        id: "new-id",
        title: "Title",
      });
      createPortfolioItem.mockResolvedValue({ data: created, error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      const res = await result.current.createItemWithImages({
        title: "Title",
      });

      expect(res.data).toEqual(created);
      expect(res.error).toBeNull();
      expect(createPortfolioItem).toHaveBeenCalledWith(providerId, {
        title: "Title",
        id: expect.any(String),
        image_paths: [],
      });
      expect(uploadPortfolioImage).not.toHaveBeenCalled();
    });

    it("uploads images then creates item with image_paths", async () => {
      const itemId = "generated-uuid";
      vi.stubGlobal("crypto", {
        randomUUID: () => itemId,
      });
      uploadPortfolioImage
        .mockResolvedValueOnce({
          path: "providers/prov-1/portfolio/xxx/image-1.jpg",
          error: null,
        })
        .mockResolvedValueOnce({
          path: "providers/prov-1/portfolio/xxx/image-2.png",
          error: null,
        });
      const created = makePortfolioItem({
        id: itemId,
        title: "Work",
        image_paths: [
          "providers/prov-1/portfolio/xxx/image-1.jpg",
          "providers/prov-1/portfolio/xxx/image-2.png",
        ],
      });
      createPortfolioItem.mockResolvedValue({ data: created, error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      const file1 = new File(["a"], "a.jpg", { type: "image/jpeg" });
      const file2 = new File(["b"], "b.png", { type: "image/png" });

      const res = await result.current.createItemWithImages({
        title: "Work",
        imageFiles: [file1, file2],
      });

      expect(res.data).toEqual(created);
      expect(res.error).toBeNull();
      expect(uploadPortfolioImage).toHaveBeenCalledTimes(2);
      expect(createPortfolioItem).toHaveBeenCalledWith(providerId, {
        title: "Work",
        id: itemId,
        image_paths: [
          "providers/prov-1/portfolio/xxx/image-1.jpg",
          "providers/prov-1/portfolio/xxx/image-2.png",
        ],
      });
    });

    it("returns error when upload fails and does not call createPortfolioItem", async () => {
      const itemId = "generated-uuid";
      vi.stubGlobal("crypto", { randomUUID: () => itemId });
      uploadPortfolioImage.mockResolvedValue({
        path: null,
        error: "Upload failed",
      });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
      const res = await result.current.createItemWithImages({
        title: "Work",
        imageFiles: [file],
      });

      expect(res.data).toBeNull();
      expect(res.error).toBe("Upload failed");
      expect(createPortfolioItem).not.toHaveBeenCalled();
    });

    it("returns error when createPortfolioItem fails and rolls back uploaded files", async () => {
      const itemId = "gen-1";
      vi.stubGlobal("crypto", { randomUUID: () => itemId });
      uploadPortfolioImage.mockResolvedValue({
        path: "providers/prov-1/portfolio/gen-1/image-1.jpg",
        error: null,
      });
      createPortfolioItem.mockResolvedValue({
        data: null,
        error: "DB error",
      });
      removePortfolioImageFromStorage.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
      const res = await result.current.createItemWithImages({
        title: "Work",
        imageFiles: [file],
      });

      expect(res.data).toBeNull();
      expect(res.error).toBe("DB error");
      expect(removePortfolioImageFromStorage).toHaveBeenCalledWith(
        expect.anything(),
        "providers/prov-1/portfolio/gen-1/image-1.jpg"
      );
    });

    it("throws when providerId is null", async () => {
      useAuth.mockReturnValue({ profile: null } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.createItemWithImages({ title: "T" })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
