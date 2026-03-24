import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Tabs } from "@/components/ui/tabs";
import { ClientMyServicesHeader } from "./ClientMyServicesHeader";
import { ClientMyServicesSearchBar } from "./ClientMyServicesSearchBar";
import { ClientMyServicesStatusTabs } from "./ClientMyServicesStatusTabs";
import { ClientMyServicesFiltersBar } from "./ClientMyServicesFiltersBar";
import { ClientMyServicesCard } from "./ClientMyServicesCard";
import { ClientMyServicesCardSkeleton } from "./ClientMyServicesCardSkeleton";
import { ClientMyServicesEmptyState } from "./ClientMyServicesEmptyState";
import { ClientMyServicesErrorState } from "./ClientMyServicesErrorState";
import { ClientMyServicesNoFilterResultsState } from "./ClientMyServicesNoFilterResultsState";
import { ClientMyServicesFocusBanner } from "./ClientMyServicesFocusBanner";
import { QuestionThreadSheet, ReceivedBudgetDetailsSheet } from "@/features/client-budgets";
import { OpenServiceDetailsSheet } from "./OpenServiceDetailsSheet";
import { useClientMyServicesPage } from "../hooks/useClientMyServicesPage";
import type { StatusTabId } from "../constants/statusTabs";
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
    detailsMode,
    setDetailsMode,
    selectedServiceRequestId,
    selectedOpenService,
    setSelectedOpenService,
    cancelServiceRequest,
    isCancelling,
    handleClearFocusFilter,
    handleClearFilters,
    handleOpenBudgets,
    handleOpenQuestions,
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
        <Tabs
          value={filters.statusTabId}
          onValueChange={(v) => setStatusTabId(v as StatusTabId)}
        >
          <ClientMyServicesStatusTabs
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
                  <ClientMyServicesCardSkeleton />
                </li>
              ))}
            </ul>
          )}
          {!isLoading && isError && (
            <ClientMyServicesErrorState onRetry={() => refetch()} />
          )}
          {!isLoading && !isError && items.length === 0 && hasActiveFilters && (
            <ClientMyServicesNoFilterResultsState onClearFilters={handleClearFilters} />
          )}
          {!isLoading && !isError && items.length === 0 && !hasActiveFilters && (
            <ClientMyServicesEmptyState />
          )}
          {!isLoading && !isError && items.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-1">
              {items.map((model) => (
                <li key={model.id} id={`service-request-${model.id}`}>
                  <ClientMyServicesCard
                    model={model}
                    onCancel={cancelServiceRequest}
                    onOpenBudgets={handleOpenBudgets}
                    onOpenQuestions={handleOpenQuestions}
                    onOpenDetails={handleOpenDetails}
                    isCancelling={isCancelling}
                  />
                </li>
              ))}
            </ul>
          )}
          {!isLoading && !isError && items.length > 0 && hasNextPage && (
            <LoadMoreButton
              onLoadMore={() => {
                void fetchNextPage();
              }}
              isLoading={isFetchingNextPage}
            />
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
      <OpenServiceDetailsSheet
        open={Boolean(selectedOpenService)}
        serviceRequest={selectedOpenService}
        onOpenChange={(next) => {
          if (!next) setSelectedOpenService(null);
        }}
      />
    </div>
  );
}
