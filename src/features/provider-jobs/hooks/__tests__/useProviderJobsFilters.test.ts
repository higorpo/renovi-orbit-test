import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProviderJobsFilters } from "../useProviderJobsFilters";

describe("useProviderJobsFilters", () => {
  it("starts with default sort, radius, and null service", () => {
    const { result } = renderHook(() => useProviderJobsFilters());
    expect(result.current.filters.sortMode).toBe("nearest");
    expect(result.current.filters.radiusKm).toBe(10);
    expect(result.current.filters.serviceId).toBeNull();
  });

  it("updates sort, radius, and service independently", () => {
    const { result } = renderHook(() => useProviderJobsFilters());

    act(() => {
      result.current.setSortMode("newest");
    });
    expect(result.current.filters.sortMode).toBe("newest");

    act(() => {
      result.current.setRadiusKm(20);
    });
    expect(result.current.filters.radiusKm).toBe(20);

    act(() => {
      result.current.setServiceId("svc-1");
    });
    expect(result.current.filters.serviceId).toBe("svc-1");
  });

  it("resetFilters restores defaults", () => {
    const { result } = renderHook(() => useProviderJobsFilters());

    act(() => {
      result.current.setSortMode("least_competitive");
      result.current.setRadiusKm(50);
      result.current.setServiceId("x");
      result.current.resetFilters();
    });

    expect(result.current.filters.sortMode).toBe("nearest");
    expect(result.current.filters.radiusKm).toBe(10);
    expect(result.current.filters.serviceId).toBeNull();
  });
});
