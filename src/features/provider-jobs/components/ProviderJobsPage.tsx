import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useEffect } from "react";
import { useProviderLocation } from "../hooks/useProviderLocation";
import { useProviderJobs } from "../hooks/useProviderJobs";
import { useProviderJobsFilters } from "../hooks/useProviderJobsFilters";
import { useDismissOpportunity } from "../hooks/useDismissOpportunity";
import { JobsHeader } from "./JobsHeader";
import { JobsSortTabs } from "./JobsSortTabs";
import { JobCard } from "./JobCard";
import { JobCardSkeleton } from "./JobCardSkeleton";
import { JobsEmptyState } from "./JobsEmptyState";
import { JobsErrorState } from "./JobsErrorState";
import { LocationPermissionBanner } from "./LocationPermissionBanner";
import { getDefaultSortMode } from "../constants/sortModes";

const SKELETON_COUNT = 4;

export function ProviderJobsPage() {
  const location = useProviderLocation();
  const { filters, setSortMode, resetFilters } = useProviderJobsFilters();
  const { dismissOpportunity, dismissingId } = useDismissOpportunity();
  const hasFeedGps = location.hasFeedLocation;

  useEffect(() => {
    if (!hasFeedGps && filters.sortMode === "nearest") {
      setSortMode("newest");
    }
  }, [hasFeedGps, filters.sortMode, setSortMode]);

  const effectiveSortMode =
    !hasFeedGps && filters.sortMode === "nearest" ? "newest" : filters.sortMode;

  const {
    items,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useProviderJobs({
    latitude: location.hasFeedLocation ? (location.location?.latitude ?? null) : null,
    longitude: location.hasFeedLocation ? (location.location?.longitude ?? null) : null,
    sortMode: effectiveSortMode,
  });

  const hasActiveFilters = filters.sortMode !== getDefaultSortMode(hasFeedGps);

  return (
    <div className="container max-w-5xl px-4 py-6">
      <JobsHeader isUsingDefaultLocation={location.isUsingDefault} />

      {location.isUsingDefault && (
        <div className="mt-4">
          <LocationPermissionBanner
            permissionDenied={location.permissionDenied}
            insecureContext={location.insecureContext}
            isNativeApp={location.isNativeApp}
            onRetry={location.retry}
          />
        </div>
      )}

      <div className="mt-6 space-y-4">
        <JobsSortTabs
          activeMode={effectiveSortMode}
          onModeChange={setSortMode}
          disabled={isLoading}
          hasFeedGps={hasFeedGps}
        />

        <section aria-label="Lista de trabalhos" id="jobs-list">
          {isLoading && (
            <ul className="grid gap-4" aria-busy="true">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <li key={i}>
                  <JobCardSkeleton />
                </li>
              ))}
            </ul>
          )}

          {!isLoading && isError && (
            <JobsErrorState onRetry={() => refetch()} />
          )}

          {!isLoading && !isError && items.length === 0 && (
            <JobsEmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={resetFilters}
            />
          )}

          {!isLoading && !isError && items.length > 0 && (
            <>
              <ul className="grid gap-4">
                {items.map((job) => (
                  <li key={job.service_request_id}>
                    <JobCard
                      job={job}
                      onDismiss={dismissOpportunity}
                      isDismissing={dismissingId === job.service_request_id}
                    />
                  </li>
                ))}
              </ul>

              {hasNextPage && (
                <LoadMoreButton
                  onLoadMore={() => {
                    void fetchNextPage();
                  }}
                  isLoading={isFetchingNextPage}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
