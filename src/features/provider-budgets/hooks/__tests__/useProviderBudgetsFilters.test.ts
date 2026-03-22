import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderBudgetsFilters } from "../useProviderBudgetsFilters";

describe("useProviderBudgetsFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes initial state and null API params when filters are default", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    expect(result.current.activeTab).toBe("enviados");
    expect(result.current.budgetStatusParam).toBeNull();
    expect(result.current.questionStatusParam).toBeNull();
    expect(result.current.searchParam).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("maps non-all filters to API params", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    act(() => {
      result.current.setBudgetStatusFilter("accepted");
      result.current.setQuestionStatusFilter("pending");
    });

    expect(result.current.budgetStatusParam).toBe("accepted");
    expect(result.current.questionStatusParam).toBe("pending");
  });

  it("debounces search into searchParam", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    act(() => {
      result.current.setSearchQuery("  hello  ");
    });
    expect(result.current.searchParam).toBeNull();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.searchParam).toBe("hello");
  });

  it("resetFilters clears status filters and search", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    act(() => {
      result.current.setBudgetStatusFilter("rejected");
      result.current.setSearchQuery("x");
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.budgetStatusFilter).toBe("all");
    expect(result.current.questionStatusFilter).toBe("all");
    expect(result.current.searchQuery).toBe("");
  });
});
