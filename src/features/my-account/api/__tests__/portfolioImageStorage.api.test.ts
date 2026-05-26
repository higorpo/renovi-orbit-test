// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validatePortfolioImageFile,
  uploadPortfolioImage,
  removePortfolioImageFromStorage,
} from "../portfolioImageStorage.api";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase() {
  return {
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as SupabaseClient;
}

describe("validatePortfolioImageFile", () => {
  it("returns null for valid JPEG", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validatePortfolioImageFile(file)).toBe(null);
  });

  it("returns null for valid PNG and WebP", () => {
    const png = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(png, "size", { value: 1024 });
    expect(validatePortfolioImageFile(png)).toBe(null);

    const webp = new File(["x"], "a.webp", { type: "image/webp" });
    Object.defineProperty(webp, "size", { value: 1024 });
    expect(validatePortfolioImageFile(webp)).toBe(null);
  });

  it("returns error for type not in allowed list", () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validatePortfolioImageFile(file)).toContain("Formato não permitido");
  });

  it("returns error when file exceeds max size (5 MB)", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    expect(validatePortfolioImageFile(file)).toContain("5 MB");
  });
});

describe("uploadPortfolioImage", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createMockSupabase();
    const chain = supabase.storage.from("provider-portfolio-images");
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id", path: "path", fullPath: "path" },
      error: null,
    });
  });

  it("returns validation error for invalid file type", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage(supabase, "prov-1", "item-1", file, 0);
    expect(result).toEqual({ path: null, error: expect.stringContaining("Formato") });
    expect(supabase.storage.from("provider-portfolio-images").upload).not.toHaveBeenCalled();
  });

  it("returns path and null error on successful upload", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage(supabase, "prov-1", "item-1", file, 0);
    expect(result.path).toContain("providers/prov-1/portfolio/item-1/");
    expect(result.path).toMatch(/image-1\.(jpg|jpeg|png|webp|heic|heif)$/);
    expect(result.error).toBeNull();
    expect(supabase.storage.from("provider-portfolio-images").upload).toHaveBeenCalled();
  });

  it("uses index for filename (image-1, image-2)", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage(supabase, "p", "i", file, 2);
    expect(result.path).toMatch(/image-3\./);
  });

  it("returns error when storage upload fails", async () => {
    vi.mocked(supabase.storage.from("provider-portfolio-images").upload).mockResolvedValue({
      data: null,
      error: { message: "Storage full" } as never,
    });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage(supabase, "prov-1", "item-1", file, 0);
    expect(result).toEqual({ path: null, error: "Storage full" });
  });
});

describe("removePortfolioImageFromStorage", () => {
  it("returns null error on success", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("provider-portfolio-images").remove).mockResolvedValue({
      data: [],
      error: null,
    });
    const result = await removePortfolioImageFromStorage(
      supabase,
      "providers/p1/portfolio/item1/image-1.jpg"
    );
    expect(result).toEqual({ error: null });
    expect(supabase.storage.from("provider-portfolio-images").remove).toHaveBeenCalledWith([
      "providers/p1/portfolio/item1/image-1.jpg",
    ]);
  });

  it("returns error when storage remove fails", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("provider-portfolio-images").remove).mockResolvedValue({
      data: null,
      error: { message: "Not found" } as never,
    });
    const result = await removePortfolioImageFromStorage(supabase, "path");
    expect(result).toEqual({ error: "Not found" });
  });
});
