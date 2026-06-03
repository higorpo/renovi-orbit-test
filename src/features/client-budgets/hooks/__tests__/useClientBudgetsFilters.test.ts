// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClientBudgetsFilters } from "../useClientBudgetsFilters";

describe("useClientBudgetsFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with default filters", () => {
    const { result } = renderHook(() => useClientBudgetsFilters());
    expect(result.current.receivedStatusFilter).toBe("awaiting_decision");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.searchParam).toBe(null);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("debounces search into searchParam", () => {
    const { result } = renderHook(() => useClientBudgetsFilters());
    act(() => {
      result.current.setSearchQuery("  hello  ");
    });
    expect(result.current.searchParam).toBe(null);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.searchParam).toBe("hello");
  });

  it("resetFilters restores defaults and clears search", () => {
    const { result } = renderHook(() => useClientBudgetsFilters());
    act(() => {
      result.current.setReceivedStatusFilter("accepted");
      result.current.setSearchQuery("x");
    });
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.receivedStatusFilter).toBe("awaiting_decision");
    expect(result.current.searchQuery).toBe("");
  });

  it("hasActiveFilters is true when status filter deviates", () => {
    const { result } = renderHook(() => useClientBudgetsFilters());
    act(() => {
      result.current.setReceivedStatusFilter("accepted");
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
