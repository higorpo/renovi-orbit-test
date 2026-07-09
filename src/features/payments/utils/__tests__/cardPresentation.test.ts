import { describe, expect, it } from "vitest";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../cardPresentation";

describe("formatCardExpiry", () => {
  it("formats 2-digit and 4-digit years", () => {
    expect(formatCardExpiry(3, 27)).toBe("03/27");
    expect(formatCardExpiry(10, 2027)).toBe("10/27");
    expect(formatCardExpiry(1, 5)).toBe("01/05");
  });
});

describe("formatMaskedCardLabel", () => {
  it("keeps last four digits when present", () => {
    expect(formatMaskedCardLabel("**** **** **** 1234")).toBe("•••• 1234");
    expect(formatMaskedCardLabel("4111111111111111")).toBe("•••• 1111");
  });

  it("returns original value when no digits exist", () => {
    expect(formatMaskedCardLabel("sem digitos")).toBe("sem digitos");
  });
});

describe("getCardBrandLabel", () => {
  it("normalizes known brands and keeps unknown as-is", () => {
    expect(getCardBrandLabel("visa")).toBe("Visa");
    expect(getCardBrandLabel("VCC")).toBe("Visa");
    expect(getCardBrandLabel("mastercard")).toBe("Mastercard");
    expect(getCardBrandLabel("MASTER")).toBe("Mastercard");
    expect(getCardBrandLabel("elo")).toBe("Elo");
    expect(getCardBrandLabel("Amex")).toBe("Amex");
  });
});
