export type {
  ListProviderOpportunitiesBody,
  ListProviderOpportunitiesFeedResponse,
  ListProviderOpportunitiesSortMode,
  ListProviderOpportunityItem,
  ListProviderOpportunitySource,
} from "@orbit/contracts/list-provider-opportunities/types.ts";

export {
  EMPTY_FEED_RESPONSE,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
} from "@orbit/contracts/list-provider-opportunities/types.ts";

import type { ListProviderOpportunitiesSortMode } from "@orbit/contracts/list-provider-opportunities/types.ts";

export interface ParsedListProviderOpportunitiesParams {
  sortMode: ListProviderOpportunitiesSortMode;
  cursor: string | null;
  limit: number;
  lat: number | null;
  lng: number | null;
}
