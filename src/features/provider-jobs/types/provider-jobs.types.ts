import type { MatchProviderJobsBody } from "../../../../supabase/functions/match-provider-jobs/types";

/** Request params for match-provider-jobs edge function. Re-exported from edge function types. */
export type FetchProviderJobsParams = MatchProviderJobsBody;

export interface ProviderJobItem {
  id: string;
  title: string;
  description: string | null;
  service_id: string;
  service_title: string;
  service_slug: string;
  service_icon_key: string | null;
  service_color_key: string | null;
  service_parent_id: string | null;
  photos: string[] | null;
  form_data: Record<string, unknown> | null;
  form_schema: FormSchema | null;
  urgency: string | null;
  scope_complexity: string | null;
  estimated_duration_hint: string | null;
  tags: string[] | null;
  suggested_equipment: string[] | null;
  suggested_materials: string[] | null;
  masked_client_name: string;
  neighborhood: string;
  city: string;
  state: string;
  distance_km: number;
  proposal_count: number;
  exact_area_match: boolean;
  created_at: string;
}

export interface FormSchema {
  version?: string;
  fields?: FormSchemaField[];
  [key: string]: unknown;
}

export interface FormSchemaField {
  id: string;
  type: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  [key: string]: unknown;
}

export interface ProviderServiceSummary {
  id: string;
  title: string;
  slug: string;
  icon_key: string | null;
  color_key: string | null;
}

export interface ProviderAreaSummary {
  cities: string[];
  neighborhoods: string[];
}

export interface ProviderJobsResponse {
  items: ProviderJobItem[];
  total_count: number;
  page: number;
  page_size: number;
  provider_services: ProviderServiceSummary[];
  provider_area_summary: ProviderAreaSummary;
}

export type SortMode = "nearest" | "newest" | "least_competitive";

export interface ProviderJobsFilterState {
  sortMode: SortMode;
  radiusKm: number;
  serviceId: string | null;
}

export const MAX_PROPOSALS_PER_REQUEST = 3;
