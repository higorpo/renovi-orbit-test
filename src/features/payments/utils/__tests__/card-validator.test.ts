import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isValidCardExpiry,
  isValidCvv,
  isValidLuhn,
  maskCardNumber,
  normalizeCardDigits,
  normalizeExpiryYear,
} from "../card-validator";

describe("maskCardNumber", () => {
  it("inserts spaces every four digits", () => {
    expect(maskCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(maskCardNumber("411111111111")).toBe("4111 1111 1111");
  });
});

describe("isValidLuhn", () => {
  it("accepts a valid test card number", () => {
    expect(isValidLuhn("4111111111111111")).toBe(true);
  });

  it("rejects invalid check digit and short numbers", () => {
    expect(isValidLuhn("4111111111111112")).toBe(false);
    expect(isValidLuhn("4111")).toBe(false);
  });
});

describe("normalizeCardDigits", () => {
  it("strips non-digit characters", () => {
    expect(normalizeCardDigits("4111 1111 1111 1111")).toBe("4111111111111111");
  });
});

describe("isValidCardExpiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects invalid months/years and past dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));

    expect(isValidCardExpiry(0, 2027)).toBe(false);
    expect(isValidCardExpiry(13, 2027)).toBe(false);
    expect(isValidCardExpiry(10, 1999)).toBe(false);
    expect(isValidCardExpiry(6, 2026)).toBe(false);
    expect(isValidCardExpiry(7, 2026)).toBe(true);
    expect(isValidCardExpiry(10, 2027)).toBe(true);
  });
});

describe("normalizeExpiryYear", () => {
  it("expands 2-digit years and keeps 4-digit years", () => {
    expect(normalizeExpiryYear("27")).toBe(2027);
    expect(normalizeExpiryYear(2030)).toBe(2030);
  });
});

describe("isValidCvv", () => {
  it("accepts 3 or 4 digits only", () => {
    expect(isValidCvv("123")).toBe(true);
    expect(isValidCvv("1234")).toBe(true);
    expect(isValidCvv("12")).toBe(false);
  });
});
