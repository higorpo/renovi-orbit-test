import { describe, it, expect } from "vitest";
import { signUpSchema, validateFullName, zodIssuesToFieldErrors } from "../signup.validation";

describe("validateFullName", () => {
  it("returns null for valid first and last name", () => {
    expect(validateFullName("João Silva")).toBeNull();
  });

  it("returns error for single name", () => {
    expect(validateFullName("João")).toBe("Informe nome e sobrenome");
  });

  it("returns error for empty string", () => {
    expect(validateFullName("")).toBe("Nome é obrigatório");
  });

  it("returns error for whitespace only", () => {
    expect(validateFullName("   ")).toBe("Nome é obrigatório");
  });

  it("accepts name with multiple spaces", () => {
    expect(validateFullName("João  da  Silva")).toBeNull();
  });
});

describe("signUpSchema", () => {
  const validData = {
    fullName: "João Silva",
    email: "joao@example.com",
    password: "MyPassword1!",
    confirmPassword: "MyPassword1!",
    termsAccepted: true,
  };

  it("accepts valid data", () => {
    const result = signUpSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects single name", () => {
    const result = signUpSchema.safeParse({ ...validData, fullName: "João" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({ ...validData, email: "bad-email" });
    expect(result.success).toBe(false);
  });

  it("rejects password under 10 chars", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatching passwords", () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: "MyPassword1!",
      confirmPassword: "OtherPass1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("As senhas não coincidem");
    }
  });

  it("rejects when terms not accepted", () => {
    const result = signUpSchema.safeParse({ ...validData, termsAccepted: false });
    expect(result.success).toBe(false);
  });
});

describe("zodIssuesToFieldErrors (re-export)", () => {
  it("maps path[0] string key to error message", () => {
    const result = signUpSchema.safeParse({ fullName: "", email: "bad", password: "", confirmPassword: "", termsAccepted: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodIssuesToFieldErrors(result.error.issues);
      expect(typeof errors).toBe("object");
      // At least email should be mapped
      expect(errors.email).toBeDefined();
    }
  });
});
