// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { getClientEmailRedirectTo } from "../useClientSignupForm";

describe("getClientEmailRedirectTo", () => {
  it("returns empty string when window is undefined", () => {
    const prev = globalThis.window;
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    try {
      expect(getClientEmailRedirectTo()).toBe("");
    } finally {
      globalThis.window = prev;
    }
  });

  it("returns onboarding URL with origin", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://app.example.com" },
      writable: true,
    });
    expect(getClientEmailRedirectTo()).toBe(
      "https://app.example.com/onboarding/client"
    );
  });
});
