// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useServiceRequestBudgetSheet } from "../useServiceRequestBudgetSheet";

describe("useServiceRequestBudgetSheet", () => {
  it("opens sheet in compare mode for negotiation", () => {
    const { result } = renderHook(() => useServiceRequestBudgetSheet());

    act(() => {
      result.current.openBudgetSheet({ id: "sr-1", listPhase: "negotiation" });
    });

    expect(result.current.budgetSheetOpen).toBe(true);
    expect(result.current.selectedServiceRequestId).toBe("sr-1");
    expect(result.current.selectedBudgetSheetMode).toBe("compare");
  });

  it("opens sheet in history mode outside negotiation", () => {
    const { result } = renderHook(() => useServiceRequestBudgetSheet());

    act(() => {
      result.current.openBudgetSheet({ id: "sr-2", listPhase: "completed" });
    });

    expect(result.current.selectedBudgetSheetMode).toBe("history");
  });

  it("allows closing the sheet", () => {
    const { result } = renderHook(() => useServiceRequestBudgetSheet());

    act(() => {
      result.current.openBudgetSheet({ id: "sr-1", listPhase: "negotiation" });
      result.current.setBudgetSheetOpen(false);
    });

    expect(result.current.budgetSheetOpen).toBe(false);
  });
});
