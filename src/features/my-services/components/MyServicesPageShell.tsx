import type { ReactNode } from "react";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Tabs } from "@/components/ui/tabs";
import type { ServiceModel } from "@/features/view-services";
import type { MyServicesFilterState } from "../types/my-services.types";
import { MyServicesSearchBar } from "./shared/MyServicesSearchBar";
import { MyServicesStatusTabs } from "./shared/MyServicesStatusTabs";
import { MyServicesFiltersBar } from "./shared/MyServicesFiltersBar";
import { MyServicesCardSkeleton } from "./shared/MyServicesCardSkeleton";
import { MyServicesErrorState } from "./shared/MyServicesErrorState";
import { MyServicesNoFilterResultsState } from "./shared/MyServicesNoFilterResultsState";

const SKELETON_COUNT = 4;

export interface MyServicesPageShellProps {
  header: ReactNode;
  emptyState: ReactNode;
  focusBanner?: ReactNode;
  footer?: ReactNode;
  filters: MyServicesFilterState;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onStatusTabChange: (id: MyServicesFilterState["statusTabId"]) => void;
  onCategoryChange: (id: string | null) => void;
  onCityChange: (name: string | null) => void;
  onNeighborhoodChange: (name: string | null) => void;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  onHasProposalsChange: (v: boolean | null) => void;
  onHasImagesChange: (v: boolean | null) => void;
  categoryOptions: string[];
  cityOptions: string[];
  neighborhoodOptions: string[];
  hasProposalsLabel?: string;
  items: ServiceModel[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  renderCard: (model: ServiceModel) => ReactNode;
}

export function MyServicesPageShell({
  header,
  emptyState,
  focusBanner,
  footer,
  filters,
  searchQuery,
  onSearchQueryChange,
  onStatusTabChange,
  onCategoryChange,
  onCityChange,
  onNeighborhoodChange,
  onDateRangeChange,
  onHasProposalsChange,
  onHasImagesChange,
  categoryOptions,
  cityOptions,
  neighborhoodOptions,
  hasProposalsLabel,
  items,
  isLoading,
  isFetchingNextPage,
  isError,
  hasActiveFilters,
  hasNextPage,
  onRetry,
  onClearFilters,
  onLoadMore,
  renderCard,
}: MyServicesPageShellProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-6">
      {header}
      <div className="mt-6 space-y-4">
        {focusBanner}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <MyServicesSearchBar
              value={searchQuery}
              onChange={onSearchQueryChange}
              disabled={isLoading}
            />
          </div>
          <MyServicesFiltersBar
            filters={filters}
            onCategoryChange={onCategoryChange}
            onCityChange={onCityChange}
            onNeighborhoodChange={onNeighborhoodChange}
            onDateRangeChange={onDateRangeChange}
            onHasProposalsChange={onHasProposalsChange}
            onHasImagesChange={onHasImagesChange}
            categoryOptions={categoryOptions}
            cityOptions={cityOptions}
            neighborhoodOptions={neighborhoodOptions}
            hasProposalsLabel={hasProposalsLabel}
            disabled={isLoading}
          />
        </div>
        <div className="min-w-0 max-w-full">
          <Tabs value={filters.statusTabId}>
            <MyServicesStatusTabs
              activeTabId={filters.statusTabId}
              onTabChange={onStatusTabChange}
              disabled={isLoading}
            />
          </Tabs>
        </div>
        <section className="mt-4" aria-label="Lista de serviços" id="services-list">
          {isLoading ? (
            <ul className="grid gap-4 sm:grid-cols-1" aria-busy="true">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <li key={i}>
                  <MyServicesCardSkeleton />
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && isError ? <MyServicesErrorState onRetry={onRetry} /> : null}
          {!isLoading && !isError && items.length === 0 && hasActiveFilters ? (
            <MyServicesNoFilterResultsState onClearFilters={onClearFilters} />
          ) : null}
          {!isLoading && !isError && items.length === 0 && !hasActiveFilters ? emptyState : null}
          {!isLoading && !isError && items.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-1">
              {items.map((model) => (
                <li key={model.id} id={`service-request-${model.id}`}>
                  {renderCard(model)}
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && !isError && items.length > 0 && hasNextPage ? (
            <LoadMoreButton onLoadMore={onLoadMore} isLoading={isFetchingNextPage} />
          ) : null}
        </section>
      </div>
      {footer}
    </div>
  );
}
