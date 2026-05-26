// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { accountFormSchema, defaultAccountFormData } from "../accountForm.validation";

describe("accountFormSchema", () => {
  it("accepts valid full name, empty phone and cpf", () => {
    const result = accountFormSchema.safeParse({
      full_name: "Maria Silva",
      phone: "",
      cpf: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid phone and cpf", () => {
    const result = accountFormSchema.safeParse({
      full_name: "Maria Silva",
      phone: "(48) 99999-9999",
      cpf: "529.982.247-25",
    });
    expect(result.success).toBe(true);
  });

  it("rejects single name", () => {
    const result = accountFormSchema.safeParse({
      full_name: "Maria",
      phone: "",
      cpf: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty full_name", () => {
    const result = accountFormSchema.safeParse({
      full_name: "",
      phone: "",
      cpf: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid CPF", () => {
    const result = accountFormSchema.safeParse({
      full_name: "Maria Silva",
      phone: "",
      cpf: "111.111.111-11",
    });
    expect(result.success).toBe(false);
  });
});

describe("defaultAccountFormData", () => {
  it("returns trimmed full_name and empty phone/cpf when missing", () => {
    const data = defaultAccountFormData({ full_name: "  Maria  " });
    expect(data.full_name).toBe("Maria");
    expect(data.phone).toBe("");
    expect(data.cpf).toBe("");
  });

  it("includes profile phone and cpf when present", () => {
    const data = defaultAccountFormData({
      full_name: "Maria",
      phone: "(48) 99999-9999",
      cpf: "529.982.247-25",
    });
    expect(data.phone).toBe("(48) 99999-9999");
    expect(data.cpf).toBe("529.982.247-25");
  });
});
