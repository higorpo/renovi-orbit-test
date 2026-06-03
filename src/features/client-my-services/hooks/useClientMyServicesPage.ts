import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useClientMyServicesList } from "./useClientMyServicesList";
import { useClientMyServicesFilters } from "./useClientMyServicesFilters";
import { useClientMyServicesCancel } from "./useClientMyServicesCancel";
import { SERVICE_REQUEST_FOCUS_QUERY } from "../constants/routes";
import { statusToTabId } from "../constants/statusTabs";
import type { ServiceRequestCardModel } from "../types/client-my-services.types";

const SEARCH_DEBOUNCE_MS = 300;

export function useClientMyServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusServiceRequestId = searchParams.get(SERVICE_REQUEST_FOCUS_QUERY);
  const { cancelServiceRequest, isCancelling } = useClientMyServicesCancel();

  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryDebounced = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);
  const [selectedOpenService, setSelectedOpenService] = useState<ServiceRequestCardModel | null>(
    null
  );

  const {
    filters,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
  } = useClientMyServicesFilters({ searchQueryDebounced });

  const {
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
  } = useClientMyServicesList({
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

  const focusedRequest = useMemo(() => {
    if (!focusServiceRequestId) return null;
    return items.find((m) => m.id === focusServiceRequestId) ?? null;
  }, [focusServiceRequestId, items]);

  useEffect(() => {
    if (!focusServiceRequestId || !focusedRequest) return;
    setStatusTabId(statusToTabId(focusedRequest.status));
  }, [focusServiceRequestId, focusedRequest, setStatusTabId]);

  const scrolledToFocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusServiceRequestId) {
      scrolledToFocusIdRef.current = null;
      return;
    }
    if (isLoading || items.length !== 1) return;
    if (scrolledToFocusIdRef.current === focusServiceRequestId) return;
    scrolledToFocusIdRef.current = focusServiceRequestId;
    requestAnimationFrame(() => {
      document
        .getElementById(`service-request-${focusServiceRequestId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusServiceRequestId, items.length, isLoading]);

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

  const handleClearFocusFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(SERVICE_REQUEST_FOCUS_QUERY);
      return next;
    });
  }, [setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setCategoryId(null);
    setCityName(null);
    setNeighborhoodName(null);
    setDateRange(null, null);
    setHasProposals(null);
    setHasImages(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(SERVICE_REQUEST_FOCUS_QUERY);
      return next;
    });
  }, [
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
    setSearchParams,
  ]);

  const handleOpenBudgets = useCallback((serviceRequestId: string) => {
    setSelectedServiceRequestId(serviceRequestId);
    setDetailsOpen(true);
  }, []);

  const handleOpenDetails = useCallback((model: ServiceRequestCardModel) => {
    if (model.status !== "open") {
      toast.info("Visualização detalhada para este status ainda está em construção.");
      return;
    }
    setSelectedOpenService(model);
  }, []);

  useEffect(() => {
    if (!detailsOpen && !selectedOpenService) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [detailsOpen, selectedOpenService]);

  return {
    // search
    searchQuery,
    setSearchQuery,
    // filters
    filters,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setNeighborhoodName,
    setDateRange,
    setHasProposals,
    setHasImages,
    // list
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    // derived
    hasActiveFilters,
    focusServiceRequestId,
    focusedRequest,
    categoryOptions,
    cityOptions,
    neighborhoodOptions,
    // details sheets
    detailsOpen,
    setDetailsOpen,
    selectedServiceRequestId,
    selectedOpenService,
    setSelectedOpenService,
    // actions
    cancelServiceRequest,
    isCancelling,
    handleClearFocusFilter,
    handleClearFilters,
    handleOpenBudgets,
    handleOpenDetails,
  };
}
