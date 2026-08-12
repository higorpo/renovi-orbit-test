// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validatePortfolioImageFile,
  uploadPortfolioImage,
  removePortfolioImageFromStorage,
} from "../portfolioImageStorage.api";

const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

function mockPortfolioImagesChain() {
  const chain = {
    upload: vi.fn(),
    remove: vi.fn(),
  };
  mockStorageFrom.mockReturnValue(chain);
  return chain;
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
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = mockPortfolioImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id", path: "path", fullPath: "path" },
      error: null,
    });
  });

  it("returns validation error for invalid file type", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage("prov-1", "item-1", file, 0);
    expect(result).toEqual({ path: null, error: expect.stringContaining("Formato") });
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("returns path and null error on successful upload", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage("prov-1", "item-1", file, 0);
    expect(result.path).toContain("providers/prov-1/portfolio/item-1/");
    expect(result.path).toMatch(/image-1\.(jpg|jpeg|png|webp|heic|heif)$/);
    expect(result.error).toBeNull();
    expect(mockStorageFrom).toHaveBeenCalledWith("provider-portfolio-images");
  });

  it("uses index for filename (image-1, image-2)", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage("p", "i", file, 2);
    expect(result.path).toMatch(/image-3\./);
  });

  it("returns error when storage upload fails", async () => {
    const chain = mockPortfolioImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: null,
      error: { message: "Storage full" } as never,
    });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadPortfolioImage("prov-1", "item-1", file, 0);
    expect(result).toEqual({ path: null, error: "Storage full" });
  });
});

describe("removePortfolioImageFromStorage", () => {
  it("returns null error on success", async () => {
    const chain = mockPortfolioImagesChain();
    vi.mocked(chain.remove).mockResolvedValue({
      data: [],
      error: null,
    });
    const result = await removePortfolioImageFromStorage(
      "providers/p1/portfolio/item1/image-1.jpg"
    );
    expect(result).toEqual({ error: null });
    expect(chain.remove).toHaveBeenCalledWith(["providers/p1/portfolio/item1/image-1.jpg"]);
  });

  it("returns error when storage remove fails", async () => {
    const chain = mockPortfolioImagesChain();
    vi.mocked(chain.remove).mockResolvedValue({
      data: null,
      error: { message: "Not found" } as never,
    });
    const result = await removePortfolioImageFromStorage("path");
    expect(result).toEqual({ error: "Not found" });
  });
});
