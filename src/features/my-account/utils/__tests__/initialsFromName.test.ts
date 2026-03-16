import { describe, it, expect } from "vitest";
import { initialsFromName } from "../initialsFromName";

describe("initialsFromName", () => {
  it("returns first two chars for single word", () => {
    expect(initialsFromName("Maria")).toBe("MA");
  });

  it("returns first and last initial for two words", () => {
    expect(initialsFromName("Maria Silva")).toBe("MS");
  });

  it("returns first and last initial for multiple words", () => {
    expect(initialsFromName("Maria da Silva Santos")).toBe("MS");
  });

  it("returns ? for empty string", () => {
    expect(initialsFromName("")).toBe("?");
  });

  it("returns ? for whitespace only", () => {
    expect(initialsFromName("   ")).toBe("?");
  });

  it("trims whitespace", () => {
    expect(initialsFromName("  Maria  Silva  ")).toBe("MS");
  });
});
