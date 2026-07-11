import { describe, expect, it } from "vitest";
import {
  mockProviderCompletedServices,
  mockProviderRating,
} from "../mockProviderRating";

describe("mockProviderRating", () => {
  it("returns a deterministic one-decimal rating for a provider", () => {
    const first = mockProviderRating("provider-123");
    const second = mockProviderRating("provider-123");

    expect(first).toBe(second);
    expect(first).toMatch(/^\d\.\d$/);
  });

  it.each(["", "a", "provider-123", "provider-xyz"])(
    "keeps the mock rating for %j between 4.0 and 4.9",
    (providerId) => {
      const rating = Number(mockProviderRating(providerId));

      expect(rating).toBeGreaterThanOrEqual(4);
      expect(rating).toBeLessThanOrEqual(4.9);
    },
  );
});

describe("mockProviderCompletedServices", () => {
  it("returns a deterministic completed-services count for a provider", () => {
    const first = mockProviderCompletedServices("provider-123");
    const second = mockProviderCompletedServices("provider-123");

    expect(first).toBe(second);
    expect(Number.isInteger(first)).toBe(true);
  });

  it.each(["", "a", "provider-123", "provider-xyz"])(
    "keeps the mock count for %j within its preview range",
    (providerId) => {
      const count = mockProviderCompletedServices(providerId);

      expect(count).toBeGreaterThanOrEqual(12);
      expect(count).toBeLessThanOrEqual(151);
    },
  );
});
