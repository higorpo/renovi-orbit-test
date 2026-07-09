import { describe, expect, it } from "vitest";
import { mapCheckoutStepperError } from "../mapCheckoutStepperError";

describe("mapCheckoutStepperError", () => {
  it("returns default message for nullish codes", () => {
    expect(mapCheckoutStepperError(null)).toContain("etapas do checkout");
    expect(mapCheckoutStepperError(undefined)).toContain("etapas do checkout");
    expect(mapCheckoutStepperError("")).toContain("etapas do checkout");
  });

  it("maps known codes and passthrough unknown ones", () => {
    expect(mapCheckoutStepperError("invalid_checkout_step_requirements_response")).toContain(
      "etapas do checkout",
    );
    expect(mapCheckoutStepperError("checkout_step_requirements_unavailable")).toContain(
      "etapas do checkout",
    );
    expect(mapCheckoutStepperError("custom_backend_code")).toBe("custom_backend_code");
  });
});
