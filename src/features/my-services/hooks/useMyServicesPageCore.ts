import { useState, useMemo, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMyServicesList } from "./useMyServicesList";
import { useMyServicesFilters } from "./useMyServicesFilters";

const SEARCH_DEBOUNCE_MS = 300;

export interface UseMyServicesPageCoreParams {
  serviceRequestId?: string | null;
}

export function useMyServicesPageCore(params: UseMyServicesPageCoreParams = {}) {
  const focusServiceRequestId = params.serviceRequestId ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryDebounced = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const {
    filters,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
  } = useMyServicesFilters({ searchQueryDebounced });

  const {
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
  } = useMyServicesList({
    statusTabId: filters.statusTabId,
    search: filters.searchQuery,
    categoryId: filters.categoryId,
    cityName: filters.cityName,
    neighborhoodName: filters.neighborhoodName,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    hasProposals: filters.hasProposals,
    hasImages: filters.hasImages,
    serviceRequestId: focusServiceRequestId,
  });

  const hasActiveFilters =
    filters.statusTabId !== "all" ||
    filters.searchQuery.trim().length > 0 ||
    filters.categoryId !== null ||
    filters.cityName !== null ||
    filters.neighborhoodName !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.hasProposals !== null ||
    filters.hasImages !== null ||
    Boolean(focusServiceRequestId);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.service?.title) set.add(i.service.title);
    });
    return Array.from(set).sort();
  }, [items]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.address?.cityName) set.add(i.address.cityName);
    });
    return Array.from(set).sort();
  }, [items]);

  const neighborhoodOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.address?.neighborhood) set.add(i.address.neighborhood);
    });
    return Array.from(set).sort();
  }, [items]);

  const handleClearFilters = useCallback(() => {
    setCategoryId(null);
    setCityName(null);
    setNeighborhoodName(null);
    setDateRange(null, null);
    setHasProposals(null);
    setHasImages(null);
  }, [
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    hasActiveFilters,
    categoryOptions,
    cityOptions,
    neighborhoodOptions,
    handleClearFilters,
  };
}
