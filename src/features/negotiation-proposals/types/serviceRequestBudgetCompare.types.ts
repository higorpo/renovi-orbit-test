import type { ProposalSuggestedSlotRpc } from "./proposals.types";

/** Full budget in service request compare sheet (description, photos). */
export interface ServiceRequestBudgetCompareProposal {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string | null;
  provider_profile_image_path: string | null;
  /** overall_avg when rating_count > 0; otherwise null. */
  rating_avg: number | null;
  rating_count: number;
  completed_services_count: number;
  proposed_amount: number;
  revision_count: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  proposal_description: string;
  proposal_suggested_slots: ProposalSuggestedSlotRpc[];
  photos: string[];
}

export interface ServiceRequestBudgetCompareDetail {
  service_request: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    service_title: string;
    service_slug: string;
    service_icon_key: string | null;
    service_color_key: string | null;
    neighborhood: string | null;
    city: string | null;
    state_abbr: string | null;
  };
  budgets: ServiceRequestBudgetCompareProposal[];
}
