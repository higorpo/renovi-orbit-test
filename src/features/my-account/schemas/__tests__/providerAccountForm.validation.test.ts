import { describe, it, expect } from "vitest";
import { providerAccountFormSchema } from "../providerAccountForm.validation";

const validPfBase = {
  full_name: "Maria Silva",
  phone: "",
  entity_type: "pf" as const,
  profile_visibility: "restricted" as const,
};

const validPjBase = {
  full_name: "João Santos",
  phone: "(48) 99999-9999",
  entity_type: "pj" as const,
  cnpj: "11.222.333/0001-81",
  razao_social: "Empresa LTDA",
  profile_visibility: "public" as const,
};

describe("providerAccountFormSchema", () => {
  it("accepts valid PF with minimal fields", () => {
    const result = providerAccountFormSchema.safeParse(validPfBase);
    expect(result.success).toBe(true);
  });

  it("accepts valid PF with optional fields", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      display_name: "Maria",
      bio: "Bio",
      cpf: "529.982.247-25",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid PJ with CNPJ and razao_social", () => {
    const result = providerAccountFormSchema.safeParse(validPjBase);
    expect(result.success).toBe(true);
  });

  it("rejects single name (full_name refinement)", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      full_name: "Maria",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty full_name", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      full_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid phone", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      phone: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty phone", () => {
    const result = providerAccountFormSchema.safeParse(validPfBase);
    expect(result.success).toBe(true);
  });

  it("rejects invalid CPF", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      cpf: "111.111.111-11",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PJ without CNPJ and razao_social (refine)", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      entity_type: "pj",
      cnpj: "",
      razao_social: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PJ with only CNPJ (no razao_social)", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPjBase,
      razao_social: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects display_name over 120 chars", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      display_name: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects bio over 2000 chars", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      bio: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID in service_area_neighborhood_ids", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      service_area_neighborhood_ids: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUIDs in service_area_neighborhood_ids", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPfBase,
      service_area_neighborhood_ids: [
        "550e8400-e29b-41d4-a716-446655440000",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid legal_representative_cpf", () => {
    const result = providerAccountFormSchema.safeParse({
      ...validPjBase,
      legal_representative_cpf: "111.111.111-11",
    });
    expect(result.success).toBe(false);
  });
});
