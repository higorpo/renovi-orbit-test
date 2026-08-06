/** Single offered service as returned by the public profile RPC. */
export interface ProviderPublicService {
  service_id: string;
  title: string;
  icon_key: string | null;
  color_key: string | null;
}

/** Single portfolio item as returned by the public profile RPC (public visibility only). */
export interface ProviderPortfolioItemPublic {
  id: string;
  title: string;
  description: string | null;
  service_id: string | null;
  execution_date: string | null;
  image_paths: string[];
  city_region: string | null;
  sort_order: number;
}

/** Full public provider profile as returned by get_public_provider_by_slug RPC. */
export interface ProviderPublicProfile {
  provider_id: string;
  slug: string;
  display_name: string | null;
  bio: string | null;
  profile_visibility: "public" | "restricted";
  service_area_cities: string[] | null;
  service_area_regions: string[] | null;
  service_area_neighborhoods: string[] | null;
  full_name: string | null;
  profile_image_path: string | null;
  created_at: string;
  offered_services: ProviderPublicService[];
  portfolio_items: ProviderPortfolioItemPublic[];
  /** Overall average from provider_rating_stats; null when rating_count is 0. Never use ranking_quality_score. */
  rating_avg: number | null;
  rating_count: number;
  completed_services_count: number;
}

/** Cursor for list_public_provider_ratings keyset pagination. */
export interface ProviderPublicRatingCursor {
  submitted_at: string;
  id: string;
}

/** Single public rating item (no client PII). */
export interface ProviderPublicRatingItem {
  id: string;
  overall_score: number;
  comment: string | null;
  submitted_at: string;
}

/** Cursor-paginated response from list_public_provider_ratings. */
export interface ProviderPublicRatingsPage {
  items: ProviderPublicRatingItem[];
  next_cursor: ProviderPublicRatingCursor | null;
  has_more: boolean;
}
