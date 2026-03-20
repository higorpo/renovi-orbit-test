import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useProviderLocation } from "../hooks/useProviderLocation";
import { useProviderJobs } from "../hooks/useProviderJobs";
import { useProviderJobsFilters } from "../hooks/useProviderJobsFilters";
import { JobsHeader } from "./JobsHeader";
import { JobsSortTabs } from "./JobsSortTabs";
import { JobsFiltersBar } from "./JobsFiltersBar";
import { JobCard } from "./JobCard";
import { JobCardSkeleton } from "./JobCardSkeleton";
import { JobsEmptyState } from "./JobsEmptyState";
import { JobsErrorState } from "./JobsErrorState";
import { LocationPermissionBanner } from "./LocationPermissionBanner";
import { DEFAULT_RADIUS_KM, DEFAULT_SORT_MODE } from "../constants/sortModes";

const SKELETON_COUNT = 4;

export function ProviderJobsPage() {
  const location = useProviderLocation();
  const { filters, setSortMode, setRadiusKm, setServiceId, resetFilters } =
    useProviderJobsFilters();

  const {
    items,
    totalCount,
    providerServices,
    providerAreaSummary,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useProviderJobs({
    latitude: location.location?.latitude ?? null,
    longitude: location.location?.longitude ?? null,
    radiusKm: filters.radiusKm,
    serviceId: filters.serviceId,
    sortMode: filters.sortMode,
  });

  const hasActiveFilters =
    filters.radiusKm !== DEFAULT_RADIUS_KM ||
    filters.serviceId != null ||
    filters.sortMode !== DEFAULT_SORT_MODE;

  return (
    <div className="container max-w-4xl px-4 py-6">
      <JobsHeader
        totalCount={totalCount}
        isLoading={isLoading}
        isUsingDefaultLocation={location.isUsingDefault}
        providerAreaSummary={providerAreaSummary}
      />

      {location.isUsingDefault && (
        <div className="mt-4">
          <LocationPermissionBanner
            permissionDenied={location.permissionDenied}
            insecureContext={location.insecureContext}
            onRetry={location.retry}
          />
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <JobsSortTabs
            activeMode={filters.sortMode}
            onModeChange={setSortMode}
            disabled={isLoading}
          />
          <JobsFiltersBar
            filters={filters}
            onRadiusChange={setRadiusKm}
            onServiceChange={setServiceId}
            onReset={resetFilters}
            providerServices={providerServices}
            disabled={isLoading}
          />
        </div>

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
                  <li key={job.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>

              {hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Carregando…
                      </>
                    ) : (
                      "Carregar mais"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
