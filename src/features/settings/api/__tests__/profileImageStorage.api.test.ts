// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateProfileImageFile,
  uploadProfileImage,
  removeProfileImageFromStorage,
  getProfileImageSignedUrl,
} from "../profileImageStorage.api";

const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

function mockProfileImagesChain() {
  const chain = {
    upload: vi.fn(),
    remove: vi.fn(),
    createSignedUrl: vi.fn(),
  };
  mockStorageFrom.mockReturnValue(chain);
  return chain;
}

describe("validateProfileImageFile", () => {
  it("returns null for valid JPEG", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(null);
  });

  it("returns null for valid PNG", () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(null);
  });

  it("returns null for valid WebP", () => {
    const file = new File(["x"], "a.webp", { type: "image/webp" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(null);
  });

  it("returns error for type not in allowed list", () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(
      "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.",
    );
  });

  it("returns error when file exceeds max size", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    expect(validateProfileImageFile(file)).toContain("2 MB");
  });
});

describe("uploadProfileImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = mockProfileImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id-1", path: "path", fullPath: "profile-images/path" },
      error: null,
    });
  });

  it("returns validation error for invalid file type", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result).toEqual({ path: null, error: expect.stringContaining("Formato") });
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("returns path and null error on successful upload", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result.path).toContain("users/user-1/profile/");
    expect(result.path).toMatch(/\.(jpg|jpeg|png|webp|heic|heif)$/);
    expect(result.error).toBeNull();
    expect(mockStorageFrom).toHaveBeenCalledWith("profile-images");
  });

  it("uses a unique storage path on every upload so replacements refresh in the UI", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const first = await uploadProfileImage("user-1", file);
    const second = await uploadProfileImage("user-1", file);
    expect(first.path).toBeTruthy();
    expect(second.path).toBeTruthy();
    expect(first.path).not.toBe(second.path);
    expect(first.path).toMatch(/users\/user-1\/profile\/avatar-/);
    expect(second.path).toMatch(/users\/user-1\/profile\/avatar-/);
  });

  it("removes the previous storage object after a successful replacement upload", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id-1", path: "path", fullPath: "profile-images/path" },
      error: null,
    });
    vi.mocked(chain.remove).mockResolvedValue({ data: [], error: null });

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const previousPath = "users/user-1/profile/avatar-old.jpg";
    const result = await uploadProfileImage("user-1", file, { previousPath });

    expect(result.error).toBeNull();
    expect(chain.remove).toHaveBeenCalledWith([previousPath]);
  });

  it("does not remove previousPath when it matches the new path", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id-1", path: "path", fullPath: "profile-images/path" },
      error: null,
    });
    vi.mocked(chain.remove).mockResolvedValue({ data: [], error: null });
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const samePath = "users/user-1/profile/avatar-00000000-0000-4000-8000-000000000001.jpg";
    await uploadProfileImage("user-1", file, { previousPath: samePath });

    expect(chain.remove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("still succeeds when cleaning up the previous object fails", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: { id: "id-1", path: "path", fullPath: "profile-images/path" },
      error: null,
    });
    vi.mocked(chain.remove).mockResolvedValue({
      data: null,
      error: { message: "gone" } as never,
    });

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file, {
      previousPath: "users/user-1/profile/old.jpg",
    });

    expect(result.error).toBeNull();
    expect(result.path).toBeTruthy();
  });

  it("returns validation error when file exceeds max size", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result).toEqual({ path: null, error: expect.stringContaining("2 MB") });
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("uses safe extension when file has unknown extension", async () => {
    const file = new File(["x"], "avatar.xyz", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result.path).toMatch(/avatar-.+\.jpg$/);
    expect(result.error).toBeNull();
  });

  it("uses jpg when filename splits to empty extension segment", async () => {
    const file = new File(["x"], "..", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result.path).toMatch(/avatar-.+\.jpg$/);
    expect(result.error).toBeNull();
  });

  it("returns error when storage upload fails", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.upload).mockResolvedValue({
      data: null,
      error: { message: "Storage full" } as never,
    });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage("user-1", file);
    expect(result).toEqual({ path: null, error: "Storage full" });
  });
});

describe("removeProfileImageFromStorage", () => {
  it("returns null error on success", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.remove).mockResolvedValue({
      data: [],
      error: null,
    });
    const result = await removeProfileImageFromStorage("users/u1/profile/avatar.jpg");
    expect(result).toEqual({ error: null });
    expect(chain.remove).toHaveBeenCalledWith(["users/u1/profile/avatar.jpg"]);
  });

  it("returns error when storage remove fails", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.remove).mockResolvedValue({
      data: null,
      error: { message: "Not found" } as never,
    });
    const result = await removeProfileImageFromStorage("path");
    expect(result).toEqual({ error: "Not found" });
  });
});

describe("getProfileImageSignedUrl", () => {
  it("returns signed URL on success", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.createSignedUrl).mockResolvedValue({
      data: { signedUrl: "https://signed.url/avatar" },
      error: null,
    });
    const url = await getProfileImageSignedUrl("users/u1/profile/avatar.jpg");
    expect(url).toBe("https://signed.url/avatar");
  });

  it("returns empty string on error", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.createSignedUrl).mockResolvedValue({
      data: null,
      error: { message: "Error" } as never,
    });
    const url = await getProfileImageSignedUrl("path");
    expect(url).toBe("");
  });

  it("returns empty string when data.signedUrl is missing", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.createSignedUrl).mockResolvedValue({
      data: { signedUrl: "" },
      error: null,
    });
    const url = await getProfileImageSignedUrl("path");
    expect(url).toBe("");
  });

  it("returns empty string when data is null but error is absent", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.createSignedUrl).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    const url = await getProfileImageSignedUrl("path");
    expect(url).toBe("");
  });

  it("returns empty string when data exists without signedUrl property", async () => {
    const chain = mockProfileImagesChain();
    vi.mocked(chain.createSignedUrl).mockResolvedValue({
      data: {},
      error: null,
    } as never);
    const url = await getProfileImageSignedUrl("path");
    expect(url).toBe("");
  });
});
