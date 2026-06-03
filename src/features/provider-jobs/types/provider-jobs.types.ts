import type { MatchProviderJobsBody } from "../../../../supabase/functions/match-provider-jobs/types";
import type { FormSchema } from "@/features/dynamic-form";
import type { ProposalSuggestedSlotRpc } from "@/features/negotiation-proposals";

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
  suggested_questions: string[] | null;
  suggested_equipment: string[] | null;
  suggested_materials: string[] | null;
  masked_client_name: string;
  neighborhood: string;
  city: string;
  state: string;
  distance_km: number;
  proposal_count: number;
  provider_proposal_id: string | null;
  provider_proposed_amount: number | null;
  provider_tax_rate: number | null;
  provider_tax_amount: number | null;
  provider_final_amount: number | null;
  provider_proposal_description: string | null;
  provider_proposal_duration_value: number | null;
  provider_proposal_duration_unit: "hours" | "days" | null;
  provider_proposal_suggested_slots: ProposalSuggestedSlotRpc[] | null;
  provider_proposal_photos: string[] | null;
  provider_proposal_status: string | null;
  provider_proposal_client_rejection_response: string | null;
  /** false when RPC returned a non-latest proposal row for this provider on the request. */
  is_latest_provider_proposal?: boolean | null;
  exact_area_match: boolean;
  created_at: string;
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

/** Navigation state when opening a job from the list (sheet + URL). */
export interface JobDetailLocationState {
  job?: ProviderJobItem;
  jobDetailPresentation?: "sheet";
}
