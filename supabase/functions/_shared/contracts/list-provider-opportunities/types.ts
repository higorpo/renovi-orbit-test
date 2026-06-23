/**
 * Shared request/response types for list-provider-opportunities (design §5.2).
 * Consumed by the Edge handler and frontend features (e.g. provider-jobs).
 */

/** Default page size for progressive provider feed (Req 13 AC8). */
export const FEED_DEFAULT_LIMIT = 20;

/** Maximum page size enforced by list_provider_opportunities RPC. */
export const FEED_MAX_LIMIT = 50;

export type ListProviderOpportunitiesSortMode =
  | "newest"
  | "nearest"
  | "least_competitive";

/**
 * Request body for the list-provider-opportunities edge function.
 */
export interface ListProviderOpportunitiesBody {
  /** Sort mode: "newest" (default), "nearest", "least_competitive". */
  sort_mode?: ListProviderOpportunitiesSortMode | string;
  /** Opaque cursor from a previous response. */
  cursor?: string | null;
  /** Page size. Clamped to [1, FEED_MAX_LIMIT]. Default FEED_DEFAULT_LIMIT. */
  limit?: number;
  /** Optional latitude for nearest sort / distance display (-90..90). */
  lat?: number | null;
  /** Optional longitude for nearest sort / distance display (-180..180). */
  lng?: number | null;
}

export type ListProviderOpportunitySource = "batch" | "fallback";

/**
 * Single feed row returned by list_provider_opportunities RPC (design §5.2).
 */
export interface ListProviderOpportunityItem {
  service_request_id: string;
  title: string;
  /** Client-provided service description; null or omitted when empty. */
  description: string | null;
  service_name: string;
  /** platform_services.icon_key for card styling. */
  service_icon_key: string | null;
  /** platform_services.color_key for card styling. */
  service_color_key: string | null;
  neighborhood: string;
  urgency: string;
  /** visibility.granted_at or dispatch.fallback_opened_at (ISO timestamp). */
  granted_at: string;
  distance_km: number | null;
  active_chat_count_24h: number;
  source: ListProviderOpportunitySource;
}

export interface ListProviderOpportunitiesFeedResponse {
  items: ListProviderOpportunityItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export const EMPTY_FEED_RESPONSE: ListProviderOpportunitiesFeedResponse = {
  items: [],
  next_cursor: null,
  has_more: false,
};
