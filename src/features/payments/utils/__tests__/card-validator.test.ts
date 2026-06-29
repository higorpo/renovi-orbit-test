import { describe, expect, it } from "vitest";
import {
  isValidLuhn,
  maskCardNumber,
  normalizeCardDigits,
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

  it("rejects invalid check digit", () => {
    expect(isValidLuhn("4111111111111112")).toBe(false);
  });
});

describe("normalizeCardDigits", () => {
  it("strips non-digit characters", () => {
    expect(normalizeCardDigits("4111 1111 1111 1111")).toBe("4111111111111111");
  });
});
