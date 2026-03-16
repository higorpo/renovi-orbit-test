import { describe, it, expect, vi } from "vitest";
import { validateProfileImageFile } from "../profileImageStorage.api";

describe("validateProfileImageFile", () => {
  it("returns null for valid JPEG", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).toBe(null);
  });

  it("returns error for type not in allowed list", () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: 1024 });
    expect(validateProfileImageFile(file)).not.toBe(null);
  });

  it("returns error when file exceeds max size", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });
    expect(validateProfileImageFile(file)).toContain("2 MB");
  });
});
