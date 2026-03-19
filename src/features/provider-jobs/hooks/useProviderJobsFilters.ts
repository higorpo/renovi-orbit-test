import { useState, useCallback } from "react";
import type { SortMode, ProviderJobsFilterState } from "../types/provider-jobs.types";
import { DEFAULT_SORT_MODE, DEFAULT_RADIUS_KM } from "../constants/sortModes";

const INITIAL_FILTERS: ProviderJobsFilterState = {
  sortMode: DEFAULT_SORT_MODE,
  radiusKm: DEFAULT_RADIUS_KM,
  serviceId: null,
};

export function useProviderJobsFilters() {
  const [filters, setFilters] = useState<ProviderJobsFilterState>(INITIAL_FILTERS);

  const setSortMode = useCallback((sortMode: SortMode) => {
    setFilters((prev) => ({ ...prev, sortMode }));
  }, []);

  const setRadiusKm = useCallback((radiusKm: number) => {
    setFilters((prev) => ({ ...prev, radiusKm }));
  }, []);

  const setServiceId = useCallback((serviceId: string | null) => {
    setFilters((prev) => ({ ...prev, serviceId }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  return {
    filters,
    setSortMode,
    setRadiusKm,
    setServiceId,
    resetFilters,
  };
}
