/**
 * Provider-jobs feature — Public API.
 * Progressive dispatch feed of service request opportunities for providers.
 */

export {
  ProviderJobsPage,
  ProviderJobsPersistentSlot,
  ProviderJobsRouteSlot,
} from "./components";

export {
  fetchProviderJobs,
  isInvalidProviderJobsCursorError,
} from "./api/providerJobs.api";
export { dismissProviderOpportunity } from "./api/dismissOpportunity.api";
export type { DismissProviderOpportunityResult } from "./api/dismissOpportunity.api";

export { useProviderJobs } from "./hooks/useProviderJobs";
export { useDismissOpportunity } from "./hooks/useDismissOpportunity";
export { useProviderLocation } from "./hooks/useProviderLocation";
export { useProviderJobsFilters } from "./hooks/useProviderJobsFilters";

export type {
  FetchProviderJobsParams,
  ListProviderOpportunityItem,
  ProviderJobsFilterState,
  ProviderJobsResponse,
  SortMode,
} from "./types/provider-jobs.types";
export {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
} from "./types/provider-jobs.types";

export {
  PROVIDER_JOBS_LIST_QUERY_KEY,
  providerJobsListQueryKey,
} from "./constants/queryKeys";
