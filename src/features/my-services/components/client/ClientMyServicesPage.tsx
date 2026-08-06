import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { ClientMyServicesHeader } from "./ClientMyServicesHeader";
import { ClientMyServicesEmptyState } from "./ClientMyServicesEmptyState";
import { ClientServiceListCard } from "./ClientServiceListCard";
import { ClientEvaluateServiceDialogs } from "./ClientEvaluateServiceDialogs";
import { MyServicesFocusBanner } from "../shared/MyServicesFocusBanner";
import { MyServicesPageShell } from "../MyServicesPageShell";
import { useClientMyServicesPage } from "../../hooks/useClientMyServicesPage";

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
    handleOpenMessages,
    handleOpenChat,
    handleEvaluateService,
    evaluateServiceDialog,
  } = useClientMyServicesPage();

  return (
    <>
      <MyServicesPageShell
        header={<ClientMyServicesHeader />}
        emptyState={<ClientMyServicesEmptyState />}
        focusBanner={
          <MyServicesFocusBanner
            focusServiceRequestId={focusServiceRequestId}
            focusedRequest={focusedRequest}
            isLoading={isLoading}
            onClearFocus={handleClearFocusFilter}
          />
        }
        filters={filters}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onStatusTabChange={setStatusTabId}
        onCategoryChange={setCategoryId}
        onCityChange={setCityName}
        onNeighborhoodChange={setNeighborhoodName}
        onDateRangeChange={setDateRange}
        onHasProposalsChange={setHasProposals}
        onHasImagesChange={setHasImages}
        categoryOptions={categoryOptions}
        cityOptions={cityOptions}
        neighborhoodOptions={neighborhoodOptions}
        hasProposalsLabel="Com orçamentos recebidos"
        items={items}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={hasNextPage ?? false}
        onRetry={() => void refetch()}
        onClearFilters={handleClearFilters}
        onLoadMore={() => void fetchNextPage()}
        renderCard={(model) => (
          <ClientServiceListCard
            model={model}
            onCancel={cancelServiceRequest}
            onOpenBudgets={handleOpenBudgets}
            onOpenDetails={handleOpenDetails}
            onOpenMessages={handleOpenMessages}
            onOpenChat={handleOpenChat}
            onEvaluateService={handleEvaluateService}
            isCancelling={isCancelling}
          />
        )}
        footer={
          <ReceivedBudgetDetailsSheet
            open={budgetSheetOpen}
            serviceRequestId={selectedServiceRequestId}
            sheetMode={selectedBudgetSheetMode}
            onOpenChange={(next) => {
              if (!next) setBudgetSheetOpen(false);
            }}
          />
        }
      />
      <ClientEvaluateServiceDialogs dialog={evaluateServiceDialog} />
    </>
  );
}
