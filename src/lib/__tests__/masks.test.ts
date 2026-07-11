import { describe, expect, it } from "vitest";
import { maskCEP, maskCNPJ, maskCPF, maskPhone, unmask } from "@/lib/masks";

describe("maskCPF", () => {
  it.each([
    ["123", "123"],
    ["1234", "123.4"],
    ["1234567", "123.456.7"],
    ["12345678901", "123.456.789-01"],
  ])("formats progressive input %s", (input, expected) => {
    expect(maskCPF(input)).toBe(expected);
  });

  it("ignores punctuation and limits the result to eleven digits", () => {
    expect(maskCPF("123.456.789-01 extra 2")).toBe("123.456.789-01");
  });
});

describe("maskCNPJ", () => {
  it.each([
    ["12", "12"],
    ["12A", "12.A"],
    ["12ABC3", "12.ABC.3"],
    ["12ABC3450", "12.ABC.345/0"],
    ["12ABC34501DE35", "12.ABC.345/01DE-35"],
  ])("formats progressive alphanumeric input %s", (input, expected) => {
    expect(maskCNPJ(input)).toBe(expected);
  });
});

describe("maskPhone", () => {
  it.each([
    ["11", "11"],
    ["119", "(11) 9"],
    ["1198765", "(11) 9876-5"],
    ["11987654321", "(11) 98765-4321"],
  ])("formats progressive input %s", (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it("ignores punctuation and limits the result to eleven digits", () => {
    expect(maskPhone("(11) 98765-4321 ext. 9")).toBe("(11) 98765-4321");
  });
});

describe("maskCEP", () => {
  it.each([
    ["12345", "12345"],
    ["123456", "12345-6"],
    ["12345-678", "12345-678"],
  ])("formats progressive input %s", (input, expected) => {
    expect(maskCEP(input)).toBe(expected);
  });

  it("limits the result to eight digits", () => {
    expect(maskCEP("123456789")).toBe("12345-678");
  });
});

describe("unmask", () => {
  it("removes every non-digit character", () => {
    expect(unmask("(11) 98765-4321")).toBe("11987654321");
    expect(unmask("ABC 12.345-X")).toBe("12345");
  });
});
