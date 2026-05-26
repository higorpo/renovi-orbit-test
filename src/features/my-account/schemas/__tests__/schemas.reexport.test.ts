// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { accountFormSchema, defaultAccountFormData } from "../accountForm.validation";
import { providerAccountFormSchema } from "../providerAccountForm.validation";

describe("my-account/schemas re-exports", () => {
  describe("accountForm.validation", () => {
    it("exports accountFormSchema", () => {
      expect(accountFormSchema).toBeDefined();
    });

    it("exports defaultAccountFormData", () => {
      expect(defaultAccountFormData).toBeDefined();
    });

    it("schema validates valid data via re-export", () => {
      const result = accountFormSchema.safeParse({
        full_name: "Maria Silva",
        phone: "",
        cpf: "",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("providerAccountForm.validation", () => {
    it("exports providerAccountFormSchema", () => {
      expect(providerAccountFormSchema).toBeDefined();
    });
  });
});
