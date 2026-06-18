// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProviderJobsFilters } from "../useProviderJobsFilters";

describe("useProviderJobsFilters", () => {
  it("starts with default sort mode", () => {
    const { result } = renderHook(() => useProviderJobsFilters());
    expect(result.current.filters.sortMode).toBe("newest");
  });

  it("updates sort mode", () => {
    const { result } = renderHook(() => useProviderJobsFilters());

    act(() => {
      result.current.setSortMode("newest");
    });
    expect(result.current.filters.sortMode).toBe("newest");
  });

  it("resetFilters restores default sort", () => {
    const { result } = renderHook(() => useProviderJobsFilters());

    act(() => {
      result.current.setSortMode("least_competitive");
      result.current.resetFilters();
    });

    expect(result.current.filters.sortMode).toBe("newest");
  });
});
