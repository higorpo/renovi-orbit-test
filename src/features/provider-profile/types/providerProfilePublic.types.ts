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
}
