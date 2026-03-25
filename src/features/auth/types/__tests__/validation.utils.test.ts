import { describe, it, expect } from "vitest";
import { zodIssuesToFieldErrors } from "../validation.utils";
import type { z } from "zod";

describe("zodIssuesToFieldErrors", () => {
  it("maps string-keyed path to message", () => {
    const issues: z.ZodIssue[] = [
      { code: "custom", path: ["email"], message: "Email inválido" },
      { code: "custom", path: ["password"], message: "Senha obrigatória" },
    ];
    const errors = zodIssuesToFieldErrors(issues);
    expect(errors.email).toBe("Email inválido");
    expect(errors.password).toBe("Senha obrigatória");
  });

  it("ignores issues with non-string or empty path", () => {
    const issues: z.ZodIssue[] = [
      { code: "custom", path: [0], message: "Index error" },
      { code: "custom", path: [], message: "Root error" },
    ];
    const errors = zodIssuesToFieldErrors(issues);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("returns empty object for empty issues array", () => {
    const errors = zodIssuesToFieldErrors([]);
    expect(errors).toEqual({});
  });

  it("uses the first issue per field (last wins for same key)", () => {
    // Multiple issues for the same key; the last one wins
    const issues: z.ZodIssue[] = [
      { code: "custom", path: ["email"], message: "First error" },
      { code: "custom", path: ["email"], message: "Second error" },
    ];
    const errors = zodIssuesToFieldErrors(issues);
    expect(errors.email).toBe("Second error");
  });
});
