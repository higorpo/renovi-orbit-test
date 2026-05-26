// @vitest-environment happy-dom
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

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: vi.fn() },
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
const deletePortfolioItem = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.deletePortfolioItem)
);
const updatePortfolioItem = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.updatePortfolioItem)
);
const reorderPortfolioItems = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.reorderPortfolioItems)
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

    it("does not fetch when user is not a provider", async () => {
      useAuth.mockReturnValue({
        profile: { id: "c1", role: "client" },
      } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(listPortfolioItems).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
    });

    it("surfaces API error from listPortfolioItems", async () => {
      listPortfolioItems.mockResolvedValue({ items: [], error: "List failed" });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("List failed");
      });
    });

    it("createItem delegates to createPortfolioItem", async () => {
      const created = makePortfolioItem({ id: "new-1", title: "Job" });
      createPortfolioItem.mockResolvedValue({ data: created, error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.createItem({ title: "Job" });

      expect(createPortfolioItem).toHaveBeenCalledWith(providerId, { title: "Job" });
    });

    it("updateItem delegates to updatePortfolioItem", async () => {
      updatePortfolioItem.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.updateItem({ itemId: "i1", params: { title: "Renamed" } });

      expect(updatePortfolioItem).toHaveBeenCalledWith("i1", providerId, { title: "Renamed" });
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

  describe("deleteItem", () => {
    it("deletes the DB row first, then removes images from storage", async () => {
      const item = makePortfolioItem({
        id: "item-del",
        title: "Job",
        image_paths: ["path/a.jpg", "path/b.jpg"],
      });
      listPortfolioItems.mockResolvedValue({ items: [item], error: null });
      const order: string[] = [];
      removePortfolioImageFromStorage.mockImplementation(async () => {
        order.push("storage");
        return { error: null };
      });
      deletePortfolioItem.mockImplementation(async () => {
        order.push("db");
        return { error: null };
      });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await result.current.deleteItem("item-del");

      expect(deletePortfolioItem).toHaveBeenCalledWith("item-del", providerId);
      expect(removePortfolioImageFromStorage).toHaveBeenCalledTimes(2);
      expect(order).toEqual(["db", "storage", "storage"]);
    });

    it("deletes item when there are no image paths", async () => {
      const item = makePortfolioItem({
        id: "item-plain",
        title: "Job",
        image_paths: [],
      });
      listPortfolioItems.mockResolvedValue({ items: [item], error: null });
      deletePortfolioItem.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await result.current.deleteItem("item-plain");

      expect(removePortfolioImageFromStorage).not.toHaveBeenCalled();
      expect(deletePortfolioItem).toHaveBeenCalledWith("item-plain", providerId);
    });
  });

  describe("reorderItems", () => {
    it("calls reorderPortfolioItems with ordered ids", async () => {
      reorderPortfolioItems.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await result.current.reorderItems(["b", "a"]);

      expect(reorderPortfolioItems).toHaveBeenCalledWith(providerId, ["b", "a"]);
    });
  });

  describe("updateItemWithImages", () => {
    it("uploads new files, updates item, and removes paths from storage", async () => {
      uploadPortfolioImage.mockResolvedValue({
        path: "new/path.jpg",
        error: null,
      });
      updatePortfolioItem.mockResolvedValue({ error: null });
      removePortfolioImageFromStorage.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const file = new File(["x"], "n.jpg", { type: "image/jpeg" });
      const res = await result.current.updateItemWithImages("item-1", {
        title: "Updated",
        description: "D",
        visibility: "public",
        existingImagePaths: ["keep.jpg", "old.jpg"],
        pathsToRemove: ["old.jpg"],
        imageFiles: [file],
      });

      expect(res.error).toBeNull();
      expect(uploadPortfolioImage).toHaveBeenCalled();
      expect(updatePortfolioItem).toHaveBeenCalledWith("item-1", providerId, {
        title: "Updated",
        description: "D",
        visibility: "public",
        image_paths: ["keep.jpg", "new/path.jpg"],
      });
      expect(removePortfolioImageFromStorage).toHaveBeenCalledWith(
        expect.anything(),
        "old.jpg"
      );
    });

    it("returns error and rolls back uploads when update fails", async () => {
      uploadPortfolioImage.mockResolvedValue({
        path: "uploaded/tmp.jpg",
        error: null,
      });
      updatePortfolioItem.mockResolvedValue({ error: "Update failed" });
      removePortfolioImageFromStorage.mockResolvedValue({ error: null });

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const file = new File(["x"], "n.jpg", { type: "image/jpeg" });
      const res = await result.current.updateItemWithImages("item-1", {
        title: "T",
        existingImagePaths: [],
        pathsToRemove: [],
        imageFiles: [file],
      });

      expect(res.error).toBe("Update failed");
      expect(removePortfolioImageFromStorage).toHaveBeenCalledWith(
        expect.anything(),
        "uploaded/tmp.jpg"
      );
    });

    it("throws when providerId is null", async () => {
      useAuth.mockReturnValue({ profile: null } as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => usePortfolioItems(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.updateItemWithImages("x", {
          title: "T",
          existingImagePaths: [],
          pathsToRemove: [],
        })
      ).rejects.toThrow("Not authenticated");
    });
  });
});
