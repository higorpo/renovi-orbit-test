export interface PaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
}

export type ReceivedStatusFilter =
  | "awaiting_decision"
  | "accepted"
  | "rejected";

export interface BudgetPreviewItem {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string | null;
  provider_profile_image_path: string | null;
  proposed_amount: number;
  status: string;
  created_at: string;
}

export interface ClientReceivedServiceGroup {
  service_request_id: string;
  service_request_title: string;
  service_request_description: string | null;
  service_request_status: string;
  service_request_created_at: string;
  service_title: string;
  service_slug: string;
  service_icon_key: string | null;
  service_color_key: string | null;
  neighborhood: string | null;
  city: string | null;
  state_abbr: string | null;
  latest_budget_at: string | null;
  total_budgets: number;
  submitted_count: number;
  accepted_count: number;
  rejected_count: number;
  budgets_preview: BudgetPreviewItem[];
}

/** Full budget in service request detail (includes text, photos, and client response deadline). */
export interface ClientBudgetDetailProposal extends BudgetPreviewItem {
  proposal_description: string;
  photos: string[];
  /** Deadline for client to approve/reject while status = submitted (e.g. created_at + 48h). */
  client_response_deadline_at: string | null;
}

export interface ClientBudgetDetail {
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
  budgets: ClientBudgetDetailProposal[];
}
