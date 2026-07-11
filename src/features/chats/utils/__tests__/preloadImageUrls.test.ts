// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadImageUrls } from "../preloadImageUrls";

describe("preloadImageUrls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true for an empty list without creating images", () => {
    const imageSpy = vi.spyOn(globalThis, "Image");

    return expect(preloadImageUrls([])).resolves.toBe(true).then(() => {
      expect(imageSpy).not.toHaveBeenCalled();
    });
  });

  it("resolves true when every image loads", async () => {
    vi.spyOn(globalThis, "Image").mockImplementation(function MockImage(this: {
      onload: (() => void) | null;
      onerror: (() => void) | null;
      src: string;
    }) {
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, "src", {
        set() {
          queueMicrotask(() => this.onload?.());
        },
      });
      return this;
    } as unknown as typeof Image);

    await expect(
      preloadImageUrls(["https://cdn.example/a.png", "https://cdn.example/b.png"]),
    ).resolves.toBe(true);
  });

  it("resolves false when any image fails to load", async () => {
    let call = 0;
    vi.spyOn(globalThis, "Image").mockImplementation(function MockImage(this: {
      onload: (() => void) | null;
      onerror: (() => void) | null;
      src: string;
    }) {
      this.onload = null;
      this.onerror = null;
      const index = call++;
      Object.defineProperty(this, "src", {
        set() {
          queueMicrotask(() => {
            if (index === 0) this.onload?.();
            else this.onerror?.();
          });
        },
      });
      return this;
    } as unknown as typeof Image);

    await expect(
      preloadImageUrls(["https://cdn.example/ok.png", "https://cdn.example/bad.png"]),
    ).resolves.toBe(false);
  });
});
