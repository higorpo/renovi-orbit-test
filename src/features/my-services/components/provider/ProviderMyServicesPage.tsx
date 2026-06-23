import { ProviderMyServicesHeader } from "./ProviderMyServicesHeader";
import { ProviderCalendarEntryBanner } from "@/features/provider-calendar";
import { ProviderMyServicesEmptyState } from "./ProviderMyServicesEmptyState";
import { ProviderServiceListCard } from "./ProviderServiceListCard";
import { ProviderServiceProposalDialogs } from "./ProviderServiceProposalDialogs";
import { MyServicesPageShell } from "../MyServicesPageShell";
import { useProviderMyServicesPage } from "../../hooks/useProviderMyServicesPage";

export function ProviderMyServicesPage() {
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
    categoryOptions,
    cityOptions,
    neighborhoodOptions,
    handleClearFilters,
    handleOpenDetails,
    handleOpenChat,
    handleOpenMap,
    handleReviseProposal,
    handleViewProposal,
    proposalDialogs,
  } = useProviderMyServicesPage();

  return (
    <>
      <MyServicesPageShell
        header={
          <>
            <ProviderMyServicesHeader />
            <div className="mt-4">
              <ProviderCalendarEntryBanner />
            </div>
          </>
        }
        emptyState={<ProviderMyServicesEmptyState />}
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
        hasProposalsLabel="Com proposta enviada"
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
          <ProviderServiceListCard
            model={model}
            onOpenDetails={handleOpenDetails}
            onOpenChat={handleOpenChat}
            onOpenMap={handleOpenMap}
            onReviseProposal={handleReviseProposal}
            onViewProposal={handleViewProposal}
          />
        )}
      />
      <ProviderServiceProposalDialogs dialogs={proposalDialogs} />
    </>
  );
}
