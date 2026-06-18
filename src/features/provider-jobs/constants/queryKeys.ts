import type { SortMode } from "../types/provider-jobs.types";

/**
 * React Query key roots for provider-jobs. Use partial keys with invalidateQueries
 * when invalidating list queries after mutations elsewhere in the app.
 */
export const PROVIDER_JOBS_LIST_QUERY_KEY = "provider-jobs" as const;

export function providerJobsListQueryKey(params: {
  sortMode: SortMode;
  lat: number | null;
  lng: number | null;
}) {
  return [
    PROVIDER_JOBS_LIST_QUERY_KEY,
    params.sortMode,
    params.lat,
    params.lng,
  ] as const;
}
