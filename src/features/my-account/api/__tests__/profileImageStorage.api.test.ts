import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateProfileImageFile,
  uploadProfileImage,
  removeProfileImageFromStorage,
  getProfileImageSignedUrl,
} from "../profileImageStorage.api";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase() {
  return {
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
    },
  } as unknown as SupabaseClient;
}

describe("validateProfileImageFile", () => {
  it("returns null for valid JPEG", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(null);
  });

  it("returns error for type not in allowed list", () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).not.toBe(null);
  });

  it("returns error when file exceeds max size", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    expect(validateProfileImageFile(file)).toContain("2 MB");
  });
});

describe("uploadProfileImage", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    supabase = createMockSupabase();
    const chain = supabase.storage.from("profile-images");
    vi.mocked(chain.upload).mockResolvedValue({ data: { path: "path" }, error: null });
  });

  it("returns validation error for invalid file type", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage(supabase, "user-1", file);
    expect(result).toEqual({ path: null, error: expect.stringContaining("Formato") });
    expect(supabase.storage.from("profile-images").upload).not.toHaveBeenCalled();
  });

  it("returns path and null error on successful upload", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage(supabase, "user-1", file);
    expect(result.path).toContain("users/user-1/profile/");
    expect(result.path).toMatch(/\.(jpg|jpeg|png|webp)$/);
    expect(result.error).toBeNull();
    expect(supabase.storage.from("profile-images").upload).toHaveBeenCalled();
  });

  it("returns error when storage upload fails", async () => {
    vi.mocked(supabase.storage.from("profile-images").upload).mockResolvedValue({
      data: null,
      error: { message: "Storage full" } as never,
    });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    const result = await uploadProfileImage(supabase, "user-1", file);
    expect(result).toEqual({ path: null, error: "Storage full" });
  });
});

describe("removeProfileImageFromStorage", () => {
  it("returns null error on success", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("profile-images").remove).mockResolvedValue({
      data: null,
      error: null,
    });
    const result = await removeProfileImageFromStorage(
      supabase,
      "users/u1/profile/avatar.jpg"
    );
    expect(result).toEqual({ error: null });
    expect(supabase.storage.from("profile-images").remove).toHaveBeenCalledWith([
      "users/u1/profile/avatar.jpg",
    ]);
  });

  it("returns error when storage remove fails", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("profile-images").remove).mockResolvedValue({
      data: null,
      error: { message: "Not found" } as never,
    });
    const result = await removeProfileImageFromStorage(supabase, "path");
    expect(result).toEqual({ error: "Not found" });
  });
});

describe("getProfileImageSignedUrl", () => {
  it("returns signed URL on success", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("profile-images").createSignedUrl).mockResolvedValue({
      data: { signedUrl: "https://signed.url/avatar" },
      error: null,
    });
    const url = await getProfileImageSignedUrl(supabase, "users/u1/profile/avatar.jpg");
    expect(url).toBe("https://signed.url/avatar");
  });

  it("returns empty string on error", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("profile-images").createSignedUrl).mockResolvedValue({
      data: null,
      error: { message: "Error" } as never,
    });
    const url = await getProfileImageSignedUrl(supabase, "path");
    expect(url).toBe("");
  });

  it("returns empty string when data.signedUrl is missing", async () => {
    const supabase = createMockSupabase();
    vi.mocked(supabase.storage.from("profile-images").createSignedUrl).mockResolvedValue({
      data: {},
      error: null,
    });
    const url = await getProfileImageSignedUrl(supabase, "path");
    expect(url).toBe("");
  });
});
