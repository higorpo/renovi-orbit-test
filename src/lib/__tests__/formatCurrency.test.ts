import { describe, expect, it } from "vitest";
import { formatCurrency } from "../formatCurrency";

describe("formatCurrency", () => {
  it("formats values in BRL (pt-BR)", () => {
    expect(formatCurrency(1234.56)).toMatch(/1\.234,56/);
  });
});
