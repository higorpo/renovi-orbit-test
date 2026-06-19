import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getServiceRequestPhotoDisplayUrl,
  SERVICE_REQUESTS_BUCKET,
} from "../serviceRequestPhotoStorage.api";

const mockStorageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

describe("serviceRequestPhotoStorage.api", () => {
  it("exports bucket name", () => {
    expect(SERVICE_REQUESTS_BUCKET).toBe("service-requests");
  });

  describe("getServiceRequestPhotoDisplayUrl", () => {
    let createSignedUrl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.clearAllMocks();
      createSignedUrl = vi.fn();
      mockStorageFrom.mockReturnValue({ createSignedUrl });
    });

    it("returns legacy URL unchanged", async () => {
      const url = "https://cdn.example.com/x.png";
      expect(await getServiceRequestPhotoDisplayUrl(url)).toBe(url);
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("returns signed URL when storage succeeds", async () => {
      createSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://signed.example/1" },
        error: null,
      });
      const out = await getServiceRequestPhotoDisplayUrl("path/to/key");
      expect(out).toBe("https://signed.example/1");
      expect(mockStorageFrom).toHaveBeenCalledWith("service-requests");
      expect(createSignedUrl).toHaveBeenCalledWith("path/to/key", 3600);
    });

    it("returns empty string on error or missing data", async () => {
      createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
      expect(await getServiceRequestPhotoDisplayUrl("path")).toBe("");

      createSignedUrl.mockResolvedValue({ data: {}, error: null });
      expect(await getServiceRequestPhotoDisplayUrl("path")).toBe("");
    });
  });
});
