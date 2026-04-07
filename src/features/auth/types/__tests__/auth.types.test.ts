import { describe, it, expect } from "vitest";
import { ALLOWED_ROLES, isAllowedRole } from "../auth.types";

describe("auth.types", () => {
  it("ALLOWED_ROLES lists client, provider, admin", () => {
    expect(ALLOWED_ROLES).toEqual(["client", "provider", "admin"]);
  });

  describe("isAllowedRole", () => {
    it("returns true for client, provider, admin", () => {
      (["client", "provider", "admin"] as const).forEach((role) => {
        expect(isAllowedRole(role)).toBe(true);
      });
    });

    it("returns false for null and undefined", () => {
      expect(isAllowedRole(null)).toBe(false);
      expect(isAllowedRole(undefined)).toBe(false);
    });

    it("returns false for invalid role strings", () => {
      expect(isAllowedRole("guest")).toBe(false);
      expect(isAllowedRole("")).toBe(false);
    });
  });
});
