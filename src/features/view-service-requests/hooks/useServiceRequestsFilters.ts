import { useState, useMemo, useCallback } from "react";
import { DEFAULT_STATUS_TAB_ID } from "../constants/statusTabs";
import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceRequestsFilterState } from "../types/service-request-view.types";
import { filterServiceRequests } from "../utils/filterServiceRequests";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";

const INITIAL_FILTERS: Omit<ServiceRequestsFilterState, "searchQuery"> = {
  statusTabId: DEFAULT_STATUS_TAB_ID,
  categoryId: null,
  cityName: null,
  neighborhoodName: null,
  dateFrom: null,
  dateTo: null,
  hasProposals: null,
  hasImages: null,
};

export interface UseServiceRequestsFiltersParams {
  items: ServiceRequestCardModel[];
  /** Debounced search query to apply. */
  searchQueryDebounced: string;
  /** From URL: show only this service request. */
  focusServiceRequestId: string | null;
}

export interface UseServiceRequestsFiltersResult {
  filters: ServiceRequestsFilterState;
  setStatusTabId: (id: StatusTabId) => void;
  setCategoryId: (id: string | null) => void;
  setCityName: (name: string | null) => void;
  setNeighborhoodName: (name: string | null) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setHasProposals: (v: boolean | null) => void;
  setHasImages: (v: boolean | null) => void;
  filteredItems: ServiceRequestCardModel[];
}

export function useServiceRequestsFilters({
  items,
  searchQueryDebounced,
  focusServiceRequestId,
}: UseServiceRequestsFiltersParams): UseServiceRequestsFiltersResult {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const filtersWithSearch: ServiceRequestsFilterState = useMemo(
    () => ({ ...filters, searchQuery: searchQueryDebounced }),
    [filters, searchQueryDebounced]
  );

  const filteredItems = useMemo(
    () =>
      filterServiceRequests(items, filtersWithSearch, {
        focusServiceRequestId,
      }),
    [items, filtersWithSearch, focusServiceRequestId]
  );

  const setStatusTabId = useCallback((statusTabId: StatusTabId) => {
    setFilters((prev) => ({ ...prev, statusTabId }));
  }, []);

  const setCategoryId = useCallback((categoryId: string | null) => {
    setFilters((prev) => ({ ...prev, categoryId }));
  }, []);

  const setCityName = useCallback((cityName: string | null) => {
    setFilters((prev) => ({ ...prev, cityName }));
  }, []);

  const setNeighborhoodName = useCallback((neighborhoodName: string | null) => {
    setFilters((prev) => ({ ...prev, neighborhoodName }));
  }, []);

  const setDateRange = useCallback((dateFrom: string | null, dateTo: string | null) => {
    setFilters((prev) => ({ ...prev, dateFrom, dateTo }));
  }, []);

  const setHasProposals = useCallback((hasProposals: boolean | null) => {
    setFilters((prev) => ({ ...prev, hasProposals }));
  }, []);

  const setHasImages = useCallback((hasImages: boolean | null) => {
    setFilters((prev) => ({ ...prev, hasImages }));
  }, []);

  return {
    filters: filtersWithSearch,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
    filteredItems,
  };
}
