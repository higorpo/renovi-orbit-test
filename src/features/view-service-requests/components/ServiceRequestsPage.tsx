import { useState, useMemo } from "react";
import { Tabs } from "@/components/ui/tabs";
import { MeusServicosHeader } from "./MeusServicosHeader";
import { SearchBar } from "./SearchBar";
import { StatusTabs } from "./StatusTabs";
import { FiltersBar } from "./FiltersBar";
import { ServiceCard } from "./ServiceCard";
import { ServiceCardSkeleton } from "./ServiceCardSkeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { useServiceRequestsList } from "../hooks/useServiceRequestsList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServiceRequestsFilters } from "../hooks/useServiceRequestsFilters";
import { useCancelServiceRequest } from "../hooks/useCancelServiceRequest";
import { STATUS_TABS } from "../constants/statusTabs";
import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;

function computeTabCounts(
  items: ServiceRequestCardModel[]
): Partial<Record<StatusTabId, number>> {
  const counts: Partial<Record<StatusTabId, number>> = {};
  for (const tab of STATUS_TABS) {
    if (tab.id === "all") {
      counts.all = items.length;
    } else {
      counts[tab.id] = items.filter((i) => i.statusTabId === tab.id).length;
    }
  }
  return counts;
}

export function ServiceRequestsPage() {
  const { items, isLoading, isError, refetch } = useServiceRequestsList();
  const { cancelServiceRequest, isCancelling } = useCancelServiceRequest();

  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryDebounced = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const {
    filters,
    setStatusTabId,
    setCategoryId,
    setCityName,
    setDateRange,
    setHasProposals,
    setHasImages,
    filteredItems,
  } = useServiceRequestsFilters({
    items,
    searchQueryDebounced,
  });

  const tabCounts = useMemo(
    () => computeTabCounts(items),
    [items]
  );

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

  return (
    <div className="container max-w-4xl px-4 py-6">
      <MeusServicosHeader />

      <div className="mt-6 space-y-4">
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
            onDateRangeChange={setDateRange}
            onHasProposalsChange={setHasProposals}
            onHasImagesChange={setHasImages}
            categoryOptions={categoryOptions}
            cityOptions={cityOptions}
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
            counts={tabCounts}
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

          {!isLoading && !isError && items.length === 0 && (
            <EmptyState />
          )}

          {!isLoading && !isError && items.length > 0 && filteredItems.length === 0 && (
            <div
              className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
              role="status"
            >
              Nenhum serviço encontrado com os filtros aplicados.
            </div>
          )}

          {!isLoading && !isError && filteredItems.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-1">
              {filteredItems.map((model) => (
                <li key={model.id}>
                  <ServiceCard
                    model={model}
                    onCancel={cancelServiceRequest}
                    isCancelling={isCancelling}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
