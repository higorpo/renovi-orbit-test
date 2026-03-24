import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  normalizedIncludes,
} from "../normalizeForSearch";

describe("normalizeForSearch", () => {
  it("lowercases and trims", () => {
    expect(normalizeForSearch("  ELETRICISTA  ")).toBe("eletricista");
  });

  it("removes accents", () => {
    expect(normalizeForSearch("elétrico")).toBe("eletrico");
    expect(normalizeForSearch("Florianópolis")).toBe("florianopolis");
    expect(normalizeForSearch("ação")).toBe("acao");
    expect(normalizeForSearch("coração")).toBe("coracao");
  });

  it("returns empty string for empty or invalid input", () => {
    expect(normalizeForSearch("")).toBe("");
    expect(normalizeForSearch("   ")).toBe("");
  });
});

describe("normalizedIncludes", () => {
  it("returns true when needle is empty", () => {
    expect(normalizedIncludes("anything", "")).toBe(true);
  });

  it("matches when haystack contains needle ignoring case and accents", () => {
    expect(normalizedIncludes("Serviço de encanamento", "encanamento")).toBe(
      true
    );
    expect(normalizedIncludes("Serviço de encanamento", "encanamento")).toBe(
      true
    );
    expect(normalizedIncludes("Florianópolis", "florianopolis")).toBe(true);
    expect(normalizedIncludes("Elétrico", "eletrico")).toBe(true);
  });

  it("returns false when haystack does not contain needle", () => {
    expect(normalizedIncludes("Eletricista", "Encanador")).toBe(false);
  });
});
