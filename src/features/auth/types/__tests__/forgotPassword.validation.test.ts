import { describe, it, expect } from "vitest";
import { forgotPasswordSchema, zodIssuesToFieldErrors } from "../forgotPassword.validation";

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email inválido");
    }
  });

  it("rejects missing email", () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("zodIssuesToFieldErrors (re-export)", () => {
  it("maps email issue to field errors", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodIssuesToFieldErrors(result.error.issues);
      expect(errors.email).toBe("Email inválido");
    }
  });
});
