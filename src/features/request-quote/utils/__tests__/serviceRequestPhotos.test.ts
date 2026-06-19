import { describe, expect, it } from "vitest";
import { isStoragePath } from "../serviceRequestPhotos";

describe("serviceRequestPhotos", () => {
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
});
