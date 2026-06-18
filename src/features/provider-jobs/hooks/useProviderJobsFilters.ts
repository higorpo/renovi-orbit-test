import { useState, useCallback } from "react";
import type { SortMode, ProviderJobsFilterState } from "../types/provider-jobs.types";
import { DEFAULT_SORT_MODE } from "../constants/sortModes";

const INITIAL_FILTERS: ProviderJobsFilterState = {
  sortMode: DEFAULT_SORT_MODE,
};

export function useProviderJobsFilters() {
  const [filters, setFilters] = useState<ProviderJobsFilterState>(INITIAL_FILTERS);

  const setSortMode = useCallback((sortMode: SortMode) => {
    setFilters((prev) => ({ ...prev, sortMode }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  return {
    filters,
    setSortMode,
    resetFilters,
  };
}
