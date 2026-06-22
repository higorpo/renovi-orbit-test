import { describe, it, expect } from "vitest";
import { normalizeCNPJ, validateCNPJ } from "@/lib/cnpj";
import { maskCNPJ } from "@/lib/masks";

describe("normalizeCNPJ", () => {
  it("strips punctuation and uppercases letters", () => {
    expect(normalizeCNPJ("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("limits to 14 characters", () => {
    expect(normalizeCNPJ("12ABC34501DE351234")).toBe("12ABC34501DE35");
  });
});

describe("validateCNPJ", () => {
  it("accepts classic numeric CNPJ", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validateCNPJ("11222333000181")).toBe(true);
  });

  it("accepts alphanumeric CNPJ (RFB example)", () => {
    expect(validateCNPJ("12.ABC.345/01DE-35")).toBe(true);
    expect(validateCNPJ("12abc34501de35")).toBe(true);
  });

  it("rejects invalid check digits", () => {
    expect(validateCNPJ("11.222.333/0001-80")).toBe(false);
    expect(validateCNPJ("12.ABC.345/01DE-34")).toBe(false);
  });

  it("rejects wrong length or invalid characters", () => {
    expect(validateCNPJ("11.222.333/0001")).toBe(false);
    expect(validateCNPJ("12.ABC.345/01D@-35")).toBe(false);
  });

  it("rejects trivially invalid bodies (all same character)", () => {
    expect(validateCNPJ("00.000.000/0000-00")).toBe(false);
    expect(validateCNPJ("11.111.111/1111-11")).toBe(false);
  });

  it("rejects letters in check digit positions", () => {
    expect(validateCNPJ("12ABC34501DE3A")).toBe(false);
  });
});

describe("maskCNPJ", () => {
  it("formats numeric CNPJ", () => {
    expect(maskCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formats alphanumeric CNPJ preserving letters", () => {
    expect(maskCNPJ("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });
});
