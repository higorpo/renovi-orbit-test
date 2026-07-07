import { describe, expect, it } from "vitest";
import { resolveCheckoutSteps } from "../resolveCheckoutSteps";

describe("resolveCheckoutSteps", () => {
  it("starts at CPF step when profile is missing CPF", () => {
    const steps = resolveCheckoutSteps({
      needs_cpf: true,
      needs_phone: false,
      needs_card: false,
    });

    expect(steps[0]).toBe("cpf");
    expect(steps).toEqual(["cpf", "card", "installments", "confirmation"]);
  });

  it("skips CPF and phone when profile is complete and card is saved", () => {
    const steps = resolveCheckoutSteps({
      needs_cpf: false,
      needs_phone: false,
      needs_card: false,
    });

    expect(steps).toEqual(["card", "installments", "confirmation"]);
    expect(steps).not.toContain("cpf");
    expect(steps).not.toContain("phone");
  });

  it("preserves step order CPF → phone → card → installments → confirmation", () => {
    const steps = resolveCheckoutSteps({
      needs_cpf: true,
      needs_phone: true,
      needs_card: true,
    });

    expect(steps).toEqual([
      "cpf",
      "phone",
      "card",
      "installments",
      "confirmation",
    ]);
  });
});
