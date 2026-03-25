import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getServiceRequestPhotoDisplayUrl,
  isStoragePath,
  SERVICE_REQUESTS_BUCKET,
} from "../serviceRequestPhotos";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("serviceRequestPhotos", () => {
  it("exports bucket name", () => {
    expect(SERVICE_REQUESTS_BUCKET).toBe("service-requests");
  });

  describe("isStoragePath", () => {
    it("returns false for empty string", () => {
      expect(isStoragePath("")).toBe(false);
    });

    it("returns false for http(s) URLs", () => {
      expect(isStoragePath("https://example.com/a.jpg")).toBe(false);
      expect(isStoragePath("http://example.com/a.jpg")).toBe(false);
    });

    it("returns true for path-like values", () => {
      expect(isStoragePath("user/photo.jpg")).toBe(true);
    });
  });

  describe("getServiceRequestPhotoDisplayUrl", () => {
    let createSignedUrl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createSignedUrl = vi.fn();
    });

    function makeClient(): SupabaseClient {
      return {
        storage: {
          from: vi.fn(() => ({
            createSignedUrl,
          })),
        },
      } as unknown as SupabaseClient;
    }

    it("returns legacy URL unchanged", async () => {
      const url = "https://cdn.example.com/x.png";
      expect(await getServiceRequestPhotoDisplayUrl(makeClient(), url)).toBe(url);
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("returns signed URL when storage succeeds", async () => {
      createSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://signed.example/1" },
        error: null,
      });
      const out = await getServiceRequestPhotoDisplayUrl(makeClient(), "path/to/key");
      expect(out).toBe("https://signed.example/1");
      expect(createSignedUrl).toHaveBeenCalledWith("path/to/key", 3600);
    });

    it("returns empty string on error or missing data", async () => {
      createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
      expect(await getServiceRequestPhotoDisplayUrl(makeClient(), "path")).toBe("");

      createSignedUrl.mockResolvedValue({ data: {}, error: null });
      expect(await getServiceRequestPhotoDisplayUrl(makeClient(), "path")).toBe("");
    });
  });
});
