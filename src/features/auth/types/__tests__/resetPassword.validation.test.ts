import { describe, it, expect } from "vitest";
import { resetPasswordSchema, zodIssuesToFieldErrors } from "../resetPassword.validation";

describe("resetPasswordSchema", () => {
  it("accepts matching passwords with min length", () => {
    const result = resetPasswordSchema.safeParse({
      password: "MyPassword1!",
      confirmPassword: "MyPassword1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 10 chars", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Senha deve ter no mínimo 10 caracteres");
    }
  });

  it("rejects mismatching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "MyPassword1!",
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("As senhas não coincidem");
    }
  });

  it("rejects empty confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      password: "MyPassword1!",
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("zodIssuesToFieldErrors (re-export)", () => {
  it("converts issues array to field error record", () => {
    const result = resetPasswordSchema.safeParse({ password: "short", confirmPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodIssuesToFieldErrors(result.error.issues);
      expect(typeof errors).toBe("object");
    }
  });
});
