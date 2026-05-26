// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BUDGET_STATUS_FILTER,
  DEFAULT_QUESTION_STATUS_FILTER,
} from "../../types/provider-budgets.types";
import { useProviderBudgetsFilters } from "../useProviderBudgetsFilters";

describe("useProviderBudgetsFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes initial state with default status filters mapped to API params", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    expect(result.current.activeTab).toBe("enviados");
    expect(result.current.budgetStatusParam).toBe(DEFAULT_BUDGET_STATUS_FILTER);
    expect(result.current.questionStatusParam).toBe(DEFAULT_QUESTION_STATUS_FILTER);
    expect(result.current.searchParam).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("maps status filters to API params", () => {
    const { result } = renderHook(() => useProviderBudgetsFilters());

    act(() => {
      result.current.setBudgetStatusFilter("accepted");
      result.current.setQuestionStatusFilter("answered");
    });

    expect(result.current.budgetStatusParam).toBe("accepted");
    expect(result.current.questionStatusParam).toBe("answered");
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

    expect(result.current.budgetStatusFilter).toBe(DEFAULT_BUDGET_STATUS_FILTER);
    expect(result.current.questionStatusFilter).toBe(DEFAULT_QUESTION_STATUS_FILTER);
    expect(result.current.searchQuery).toBe("");
  });
});
