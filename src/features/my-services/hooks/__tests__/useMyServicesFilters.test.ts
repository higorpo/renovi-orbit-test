// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useMyServicesFilters } from "../useMyServicesFilters";

describe("useMyServicesFilters", () => {
  it("merges debounced search into filters", () => {
    const { result, rerender } = renderHook(
      ({ debounced }: { debounced: string }) =>
        useMyServicesFilters({ searchQueryDebounced: debounced }),
      { initialProps: { debounced: "" } }
    );
    expect(result.current.filters.searchQuery).toBe("");

    rerender({ debounced: "pintura" });
    expect(result.current.filters.searchQuery).toBe("pintura");
  });

  it("updates all filter fields via setters", () => {
    const { result } = renderHook(() =>
      useMyServicesFilters({ searchQueryDebounced: "" })
    );

    act(() => {
      result.current.setStatusTabId("in_progress");
      result.current.setCategoryId("Eletricista");
      result.current.setCityName("Florianópolis");
      result.current.setNeighborhoodName("Centro");
      result.current.setDateRange("2025-01-01", "2025-01-31");
      result.current.setHasProposals(true);
      result.current.setHasImages(false);
    });

    expect(result.current.filters.statusTabId).toBe("in_progress");
    expect(result.current.filters.categoryId).toBe("Eletricista");
    expect(result.current.filters.cityName).toBe("Florianópolis");
    expect(result.current.filters.neighborhoodName).toBe("Centro");
    expect(result.current.filters.dateFrom).toBe("2025-01-01");
    expect(result.current.filters.dateTo).toBe("2025-01-31");
    expect(result.current.filters.hasProposals).toBe(true);
    expect(result.current.filters.hasImages).toBe(false);
  });
});
