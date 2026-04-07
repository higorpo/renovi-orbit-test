import { describe, expect, it } from "vitest";
import {
  getJobDetailReturnNavigation,
  JOB_DETAIL_FROM_BUDGETS_VALUE,
  jobDetailPathFromBudgets,
} from "../jobDetailReturnNavigation";

describe("getJobDetailReturnNavigation", () => {
  it("returns budgets navigation when from=budgets", () => {
    const nav = getJobDetailReturnNavigation(JOB_DETAIL_FROM_BUDGETS_VALUE);
    expect(nav.href).toBe("/dashboard/budgets");
    expect(nav.backLabel).toContain("Orçamentos");
    expect(nav.notFoundCtaLabel).toBe("Ver orçamentos");
    expect(nav.notFoundDescription).toContain("Orçamentos");
  });

  it("returns default jobs navigation for other from values", () => {
    const nav = getJobDetailReturnNavigation("other");
    expect(nav.href).toBe("/dashboard/jobs");
    expect(nav.backLabel).toContain("Trabalhos");
    expect(nav.notFoundCtaLabel).toBe("Ver trabalhos");
  });

  it("returns default jobs navigation when from is null", () => {
    const nav = getJobDetailReturnNavigation(null);
    expect(nav.href).toBe("/dashboard/jobs");
  });
});

describe("jobDetailPathFromBudgets", () => {
  it("builds path with service request id and from query", () => {
    expect(jobDetailPathFromBudgets("abc-123")).toBe(
      "/dashboard/budgets/pedido/abc-123?from=budgets",
    );
  });
});
