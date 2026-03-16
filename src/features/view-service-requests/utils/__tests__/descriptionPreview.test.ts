import { describe, it, expect } from "vitest";
import { toDescriptionPreview } from "../descriptionPreview";

describe("toDescriptionPreview", () => {
  it("returns empty string for null or undefined", () => {
    expect(toDescriptionPreview(null)).toBe("");
    expect(toDescriptionPreview(undefined)).toBe("");
  });

  it("returns empty string for blank string", () => {
    expect(toDescriptionPreview("")).toBe("");
    expect(toDescriptionPreview("   ")).toBe("");
  });

  it("returns trimmed description when within max length", () => {
    const short = "Troca de tomadas na sala.";
    expect(toDescriptionPreview(short)).toBe(short);
    expect(toDescriptionPreview("  " + short + "  ")).toBe(short);
  });

  it("truncates and appends ellipsis when over max length", () => {
    const long = "a".repeat(200);
    const result = toDescriptionPreview(long);
    expect(result.length).toBeLessThanOrEqual(161);
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects custom maxLength", () => {
    const text = "hello world";
    expect(toDescriptionPreview(text, 5)).toBe("hello…");
  });
});
