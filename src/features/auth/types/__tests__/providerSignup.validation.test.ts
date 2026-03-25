import { describe, it, expect } from "vitest";
// providerSignup.validation re-exports from signup.validation — importing it ensures coverage
import { signUpSchema, validateFullName, zodIssuesToFieldErrors } from "../providerSignup.validation";

describe("providerSignup.validation re-exports", () => {
  it("exports signUpSchema", () => {
    expect(signUpSchema).toBeDefined();
  });

  it("exports validateFullName", () => {
    expect(validateFullName).toBeDefined();
    expect(validateFullName("Paulo Costa")).toBeNull();
  });

  it("exports zodIssuesToFieldErrors", () => {
    expect(zodIssuesToFieldErrors).toBeDefined();
  });

  it("signUpSchema validates via re-export", () => {
    const result = signUpSchema.safeParse({
      fullName: "Paulo Costa",
      email: "paulo@example.com",
      password: "MyPassword1!",
      confirmPassword: "MyPassword1!",
      termsAccepted: true,
    });
    expect(result.success).toBe(true);
  });
});
