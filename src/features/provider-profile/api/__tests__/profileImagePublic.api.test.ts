import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProfileImageSignedUrlForPublic,
  getPortfolioImageSignedUrl,
} from "../profileImagePublic.api";

const createSignedUrlMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })),
    },
  },
}));

describe("profileImagePublic.api", () => {
  beforeEach(() => {
    createSignedUrlMock.mockReset();
  });

  describe("getProfileImageSignedUrlForPublic", () => {
    it("returns signed URL on success", async () => {
      createSignedUrlMock.mockResolvedValue({
        data: { signedUrl: "https://example.com/signed" },
        error: null,
      });
      const url = await getProfileImageSignedUrlForPublic("avatars/test.jpg");
      expect(url).toBe("https://example.com/signed");
    });

    it("returns empty string on error", async () => {
      createSignedUrlMock.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });
      const url = await getProfileImageSignedUrlForPublic("missing.jpg");
      expect(url).toBe("");
    });

    it("returns empty string when data is null", async () => {
      createSignedUrlMock.mockResolvedValue({ data: null, error: null });
      const url = await getProfileImageSignedUrlForPublic("path.jpg");
      expect(url).toBe("");
    });
  });

  describe("getPortfolioImageSignedUrl", () => {
    it("returns signed URL on success", async () => {
      createSignedUrlMock.mockResolvedValue({
        data: { signedUrl: "https://example.com/portfolio-signed" },
        error: null,
      });
      const url = await getPortfolioImageSignedUrl("portfolio/img.jpg");
      expect(url).toBe("https://example.com/portfolio-signed");
    });

    it("returns empty string on error", async () => {
      createSignedUrlMock.mockResolvedValue({
        data: null,
        error: { message: "Access denied" },
      });
      const url = await getPortfolioImageSignedUrl("portfolio/secret.jpg");
      expect(url).toBe("");
    });
  });
});
