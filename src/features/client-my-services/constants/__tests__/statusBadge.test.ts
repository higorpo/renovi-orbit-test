import { describe, expect, it } from "vitest";
import { getStatusBadgeVariant } from "../statusBadge";

describe("getStatusBadgeVariant", () => {
  it("returns secondary for open status without budgets", () => {
    expect(getStatusBadgeVariant("open", 0)).toBe("secondary");
    expect(getStatusBadgeVariant("open")).toBe("secondary");
  });

  it("returns warning for open status with budgets", () => {
    expect(getStatusBadgeVariant("open", 1)).toBe("warning");
  });

  it("keeps existing variants for non-open statuses", () => {
    expect(getStatusBadgeVariant("in_progress", 0)).toBe("default");
    expect(getStatusBadgeVariant("closed", 0)).toBe("success");
    expect(getStatusBadgeVariant("cancelled", 0)).toBe("secondary");
  });
});
