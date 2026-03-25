import { describe, it, expect } from "vitest";
import { signInSchema, zodIssuesToFieldErrors } from "../login.validation";

describe("signInSchema", () => {
  it("accepts valid email and password", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Senha é obrigatória");
    }
  });

  it("rejects missing fields", () => {
    const result = signInSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("zodIssuesToFieldErrors (re-export from login.validation)", () => {
  it("maps issues to field error record", () => {
    const result = signInSchema.safeParse({ email: "bad", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodIssuesToFieldErrors(result.error.issues);
      expect(typeof errors).toBe("object");
      expect(errors.email).toBeDefined();
    }
  });
});
