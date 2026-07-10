import { describe, expect, it } from "vitest";
import { toDescriptionPreview } from "../descriptionPreview";

describe("toDescriptionPreview", () => {
  it("returns empty string for null, undefined, or blank", () => {
    expect(toDescriptionPreview(null)).toBe("");
    expect(toDescriptionPreview(undefined)).toBe("");
    expect(toDescriptionPreview("   ")).toBe("");
  });

  it("collapses whitespace and returns short text unchanged", () => {
    expect(toDescriptionPreview("  hello   world  ")).toBe("hello world");
  });

  it("truncates long text with ellipsis at maxLength", () => {
    const long = "a".repeat(200);
    expect(toDescriptionPreview(long, 10)).toBe(`${"a".repeat(10)}…`);
  });

  it("trims trailing spaces before ellipsis", () => {
    expect(toDescriptionPreview("hello world extra", 11)).toBe("hello world…");
  });
});
