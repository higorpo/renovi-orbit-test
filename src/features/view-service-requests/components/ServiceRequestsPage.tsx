import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { MeusServicosHeader } from "./MeusServicosHeader";
import { SearchBar } from "./SearchBar";
import { StatusTabs } from "./StatusTabs";
import { FiltersBar } from "./FiltersBar";
import { ServiceCard } from "./ServiceCard";
import { ServiceCardSkeleton } from "./ServiceCardSkeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { NoFilterResultsState } from "./NoFilterResultsState";
import { ServiceRequestFocusBanner } from "./ServiceRequestFocusBanner";
import { useServiceRequestsList } from "../hooks/useServiceRequestsList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServiceRequestsFilters } from "../hooks/useServiceRequestsFilters";
import { useCancelServiceRequest } from "../hooks/useCancelServiceRequest";
import { QuestionThreadSheet, ReceivedBudgetDetailsSheet } from "@/features/client-budgets";
import { SERVICE_REQUEST_FOCUS_QUERY } from "../constants/routes";
import { statusToTabId } from "../constants/statusTabs";
import type { StatusTabId } from "../constants/statusTabs";

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;

export function ServiceRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusServiceRequestId = searchParams.get(SERVICE_REQUEST_FOCUS_QUERY);
  const { cancelServiceRequest, isCancelling } = useCancelServiceRequest();

  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryDebounced = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const [detailsMode, setDetailsMode] = useState<"budgets" | "questions" | null>(null);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(
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
  } = useServiceRequestsFilters({
    searchQueryDebounced,
  });

  const {
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
  } = useServiceRequestsList({
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
    setDetailsMode("budgets");
  }, []);

  const handleOpenQuestions = useCallback((serviceRequestId: string) => {
    setSelectedServiceRequestId(serviceRequestId);
    setDetailsMode("questions");
  }, []);

  useEffect(() => {
    if (!detailsMode) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [detailsMode]);

  return (
    <div className="container max-w-5xl px-4 py-6">
      <MeusServicosHeader />

      <div className="mt-6 space-y-4">
        <ServiceRequestFocusBanner
          focusServiceRequestId={focusServiceRequestId}
          focusedRequest={focusedRequest}
          isLoading={isLoading}
          onClearFocus={handleClearFocusFilter}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              disabled={isLoading}
            />
          </div>
          <FiltersBar
            filters={filters}
            onCategoryChange={setCategoryId}
            onCityChange={setCityName}
            onNeighborhoodChange={setNeighborhoodName}
            onDateRangeChange={setDateRange}
            onHasProposalsChange={setHasProposals}
            onHasImagesChange={setHasImages}
            categoryOptions={categoryOptions}
            cityOptions={cityOptions}
            neighborhoodOptions={neighborhoodOptions}
            disabled={isLoading}
          />
        </div>

        <Tabs
          value={filters.statusTabId}
          onValueChange={(v) => setStatusTabId(v as StatusTabId)}
        >
          <StatusTabs
            activeTabId={filters.statusTabId}
            onTabChange={setStatusTabId}
            disabled={isLoading}
          />
        </Tabs>

        <section
          className="mt-4"
          aria-label="Lista de serviços"
          id="services-list"
        >
          {isLoading && (
            <ul className="grid gap-4 sm:grid-cols-1" aria-busy="true">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <li key={i}>
                  <ServiceCardSkeleton />
                </li>
              ))}
            </ul>
          )}

          {!isLoading && isError && (
            <ErrorState onRetry={() => refetch()} />
          )}

          {!isLoading && !isError && items.length === 0 && hasActiveFilters && (
            <NoFilterResultsState onClearFilters={handleClearFilters} />
          )}

          {!isLoading && !isError && items.length === 0 && !hasActiveFilters && (
            <EmptyState />
          )}

          {!isLoading && !isError && items.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-1">
              {items.map((model) => (
                <li key={model.id} id={`service-request-${model.id}`}>
                  <ServiceCard
                    model={model}
                    onCancel={cancelServiceRequest}
                    onOpenBudgets={handleOpenBudgets}
                    onOpenQuestions={handleOpenQuestions}
                    isCancelling={isCancelling}
                  />
                </li>
              ))}
            </ul>
          )}

          {!isLoading && !isError && items.length > 0 && hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  void fetchNextPage();
                }}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Carregando...
                  </>
                ) : (
                  "Carregar mais"
                )}
              </Button>
            </div>
          )}
        </section>
      </div>
      <ReceivedBudgetDetailsSheet
        open={detailsMode === "budgets"}
        serviceRequestId={selectedServiceRequestId}
        sheetMode="compare"
        onOpenChange={(next) => {
          if (!next) setDetailsMode(null);
        }}
      />
      <QuestionThreadSheet
        open={detailsMode === "questions"}
        serviceRequestId={selectedServiceRequestId}
        onOpenChange={(next) => {
          if (!next) setDetailsMode(null);
        }}
      />
    </div>
  );
}
