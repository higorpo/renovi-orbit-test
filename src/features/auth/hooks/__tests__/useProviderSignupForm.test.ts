// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { STEPS as providerSteps } from "../useProviderSignupForm";
import { SIGNUP_STEPS } from "../useSignupForm";

describe("useProviderSignupForm module", () => {
  it("re-exports SIGNUP_STEPS as STEPS", () => {
    expect(providerSteps).toEqual(SIGNUP_STEPS);
  });
});
