import { describe, it, expect } from "vitest";
import { initialsFromName } from "../initials";

describe("initialsFromName", () => {
  it("returns first and last initial for full name", () => {
    expect(initialsFromName("João Silva")).toBe("JS");
  });

  it("returns single initial for one word", () => {
    expect(initialsFromName("Maria")).toBe("MA");
  });

  it("returns ? for empty or whitespace", () => {
    expect(initialsFromName("")).toBe("?");
    expect(initialsFromName("   ")).toBe("?");
    expect(initialsFromName(null)).toBe("?");
    expect(initialsFromName(undefined)).toBe("?");
  });

  it("trims and takes first two chars for single word", () => {
    expect(initialsFromName("  Ab  ")).toBe("AB");
  });

  it("handles three-part name correctly", () => {
    expect(initialsFromName("João Pedro Silva")).toBe("JS");
  });

  it("handles single char name", () => {
    expect(initialsFromName("A")).toBe("A");
  });
});
