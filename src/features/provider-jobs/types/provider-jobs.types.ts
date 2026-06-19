import type {
  ListProviderOpportunitiesFeedResponse,
  ListProviderOpportunitiesSortMode,
} from "@/lib/contracts/list-provider-opportunities/types";

export type {
  ListProviderOpportunitiesBody,
  ListProviderOpportunitiesFeedResponse,
  ListProviderOpportunitiesSortMode,
  ListProviderOpportunityItem,
  ListProviderOpportunitySource,
} from "@/lib/contracts/list-provider-opportunities/types";

export {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
} from "@/lib/contracts/list-provider-opportunities/types";

/** Client sort mode — mirrors Edge/RPC contract. */
export type SortMode = ListProviderOpportunitiesSortMode;

export interface FetchProviderJobsParams {
  sort_mode: SortMode;
  cursor?: string | null;
  limit?: number;
  lat?: number | null;
  lng?: number | null;
}

/** Progressive feed page — same shape as list-provider-opportunities response. */
export type ProviderJobsResponse = ListProviderOpportunitiesFeedResponse;

export interface ProviderJobsFilterState {
  sortMode: SortMode;
}
