import { describe, it, expect } from "vitest";
import {
  clientSignupIdentitySchema,
  defaultClientSignupIdentity,
  identityToFullName,
} from "../clientSignupIdentity.validation";

const validData = {
  firstName: "João",
  lastName: "Silva",
  email: "joao@example.com",
  password: "MyPassword1!",
  confirmPassword: "MyPassword1!",
  termsAccepted: true,
};

describe("clientSignupIdentitySchema", () => {
  it("accepts valid data", () => {
    expect(clientSignupIdentitySchema.safeParse(validData).success).toBe(true);
  });

  it("rejects firstName shorter than 2 chars", () => {
    const result = clientSignupIdentitySchema.safeParse({ ...validData, firstName: "J" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Nome muito curto");
    }
  });

  it("rejects lastName shorter than 2 chars", () => {
    const result = clientSignupIdentitySchema.safeParse({ ...validData, lastName: "S" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Sobrenome muito curto");
    }
  });

  it("rejects invalid email", () => {
    const result = clientSignupIdentitySchema.safeParse({ ...validData, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects password under 10 chars", () => {
    const result = clientSignupIdentitySchema.safeParse({
      ...validData,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatching passwords", () => {
    const result = clientSignupIdentitySchema.safeParse({
      ...validData,
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("As senhas não coincidem");
    }
  });

  it("rejects when terms not accepted", () => {
    const result = clientSignupIdentitySchema.safeParse({ ...validData, termsAccepted: false });
    expect(result.success).toBe(false);
  });
});

describe("defaultClientSignupIdentity", () => {
  it("has all fields as empty strings and false for boolean", () => {
    expect(defaultClientSignupIdentity.firstName).toBe("");
    expect(defaultClientSignupIdentity.lastName).toBe("");
    expect(defaultClientSignupIdentity.email).toBe("");
    expect(defaultClientSignupIdentity.password).toBe("");
    expect(defaultClientSignupIdentity.confirmPassword).toBe("");
    expect(defaultClientSignupIdentity.termsAccepted).toBe(false);
  });
});

describe("identityToFullName", () => {
  it("concatenates firstName and lastName with a space", () => {
    const data = { ...defaultClientSignupIdentity, firstName: "João", lastName: "Silva" };
    expect(identityToFullName(data)).toBe("João Silva");
  });

  it("trims whitespace from both names", () => {
    const data = { ...defaultClientSignupIdentity, firstName: "  João  ", lastName: "  Silva  " };
    expect(identityToFullName(data)).toBe("João Silva");
  });
});
