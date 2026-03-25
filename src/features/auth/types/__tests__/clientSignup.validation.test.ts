import { describe, it, expect } from "vitest";
// clientSignup.validation re-exports from signup.validation — importing it ensures coverage
import { signUpSchema, validateFullName, zodIssuesToFieldErrors } from "../clientSignup.validation";

describe("clientSignup.validation re-exports", () => {
  it("exports signUpSchema", () => {
    expect(signUpSchema).toBeDefined();
  });

  it("exports validateFullName", () => {
    expect(validateFullName).toBeDefined();
    expect(validateFullName("Ana Lima")).toBeNull();
  });

  it("exports zodIssuesToFieldErrors", () => {
    expect(zodIssuesToFieldErrors).toBeDefined();
  });

  it("signUpSchema validates via re-export", () => {
    const result = signUpSchema.safeParse({
      fullName: "Ana Lima",
      email: "ana@example.com",
      password: "MyPassword1!",
      confirmPassword: "MyPassword1!",
      termsAccepted: true,
    });
    expect(result.success).toBe(true);
  });
});
