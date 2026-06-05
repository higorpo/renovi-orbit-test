import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Tabs } from "@/components/ui/tabs";
import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { ServiceListCard } from "@/features/view-services";
import { ClientMyServicesHeader } from "./ClientMyServicesHeader";
import { ClientMyServicesSearchBar } from "./ClientMyServicesSearchBar";
import { ClientMyServicesStatusTabs } from "./ClientMyServicesStatusTabs";
import { ClientMyServicesFiltersBar } from "./ClientMyServicesFiltersBar";
import { ClientMyServicesCardSkeleton } from "./ClientMyServicesCardSkeleton";
import { ClientMyServicesEmptyState } from "./ClientMyServicesEmptyState";
import { ClientMyServicesErrorState } from "./ClientMyServicesErrorState";
import { ClientMyServicesNoFilterResultsState } from "./ClientMyServicesNoFilterResultsState";
import { ClientMyServicesFocusBanner } from "./ClientMyServicesFocusBanner";
import { useClientMyServicesPage } from "../hooks/useClientMyServicesPage";

const SKELETON_COUNT = 4;

export function ClientMyServicesPage() {
  const {
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
    focusServiceRequestId,
    focusedRequest,
    categoryOptions,
    cityOptions,
    neighborhoodOptions,
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    cancelServiceRequest,
    isCancelling,
    handleClearFocusFilter,
    handleClearFilters,
    handleOpenBudgets,
    handleOpenDetails,
  } = useClientMyServicesPage();

  return (
    <div className="container max-w-5xl px-4 py-6">
      <ClientMyServicesHeader />
      <div className="mt-6 space-y-4">
        <ClientMyServicesFocusBanner
          focusServiceRequestId={focusServiceRequestId}
          focusedRequest={focusedRequest}
          isLoading={isLoading}
          onClearFocus={handleClearFocusFilter}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <ClientMyServicesSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              disabled={isLoading}
            />
          </div>
          <ClientMyServicesFiltersBar
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
        <Tabs value={filters.statusTabId}>
          <ClientMyServicesStatusTabs
            activeTabId={filters.statusTabId}
            onTabChange={setStatusTabId}
            disabled={isLoading}
          />
        </Tabs>
        <section className="mt-4" aria-label="Lista de serviços" id="services-list">
          {isLoading ? (
            <ul className="grid gap-4 sm:grid-cols-1" aria-busy="true">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <li key={i}>
                  <ClientMyServicesCardSkeleton />
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && isError ? (
            <ClientMyServicesErrorState onRetry={() => refetch()} />
          ) : null}
          {!isLoading && !isError && items.length === 0 && hasActiveFilters ? (
            <ClientMyServicesNoFilterResultsState onClearFilters={handleClearFilters} />
          ) : null}
          {!isLoading && !isError && items.length === 0 && !hasActiveFilters ? (
            <ClientMyServicesEmptyState />
          ) : null}
          {!isLoading && !isError && items.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-1">
              {items.map((model) => (
                <li key={model.id} id={`service-request-${model.id}`}>
                  <ServiceListCard
                    model={model}
                    onCancel={cancelServiceRequest}
                    onOpenBudgets={handleOpenBudgets}
                    onOpenDetails={handleOpenDetails}
                    isCancelling={isCancelling}
                    showCancelAction
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && !isError && items.length > 0 && hasNextPage ? (
            <LoadMoreButton
              onLoadMore={() => {
                void fetchNextPage();
              }}
              isLoading={isFetchingNextPage}
            />
          ) : null}
        </section>
      </div>
      <ReceivedBudgetDetailsSheet
        open={budgetSheetOpen}
        serviceRequestId={selectedServiceRequestId}
        sheetMode={selectedBudgetSheetMode}
        onOpenChange={(next) => {
          if (!next) setBudgetSheetOpen(false);
        }}
      />
    </div>
  );
}
