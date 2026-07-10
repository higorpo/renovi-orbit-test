import { describe, expect, it } from "vitest";
import { cardholderFirstNameMatchesAccount } from "../cardholderIdentity";

describe("cardholderFirstNameMatchesAccount", () => {
  it("returns true when first names match ignoring accents and case", () => {
    expect(
      cardholderFirstNameMatchesAccount("JOSE DA SILVA", "José Carlos Silva"),
    ).toBe(true);
  });

  it("returns false when first names differ", () => {
    expect(
      cardholderFirstNameMatchesAccount("Maria Silva", "João Silva"),
    ).toBe(false);
  });

  it("returns true when account name is missing (soft check skipped)", () => {
    expect(cardholderFirstNameMatchesAccount("Maria Silva", null)).toBe(true);
    expect(cardholderFirstNameMatchesAccount("Maria Silva", "   ")).toBe(true);
  });
});
