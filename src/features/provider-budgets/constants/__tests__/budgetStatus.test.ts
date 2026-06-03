import { describe, expect, it } from "vitest";
import {
  BUDGET_STATUS_CONFIG,
  BUDGET_STATUS_FILTERS,
  getBudgetStatusConfig,
} from "../budgetStatus";

describe("budgetStatus", () => {
  describe("getBudgetStatusConfig", () => {
    it("returns config for known statuses", () => {
      expect(getBudgetStatusConfig("accepted")).toEqual(BUDGET_STATUS_CONFIG.accepted);
      expect(getBudgetStatusConfig("REJECTED")).toEqual(BUDGET_STATUS_CONFIG.rejected);
      expect(getBudgetStatusConfig("REVISED")).toEqual(BUDGET_STATUS_CONFIG.revised);
    });

    it("returns unknown label when status is null, empty, or not in config", () => {
      expect(getBudgetStatusConfig(null)).toEqual({
        label: "Desconhecido",
        variant: "secondary",
      });
      expect(getBudgetStatusConfig(undefined)).toEqual({
        label: "Desconhecido",
        variant: "secondary",
      });
      expect(getBudgetStatusConfig("unknown")).toEqual({
        label: "Desconhecido",
        variant: "secondary",
      });
    });
  });

  it("exposes budget filter chips without an All option", () => {
    const budgetIds = BUDGET_STATUS_FILTERS.map((f) => f.id as string);
    expect(budgetIds.includes("all")).toBe(false);
    expect(BUDGET_STATUS_FILTERS.some((f) => f.id === "submitted")).toBe(true);
  });
});
