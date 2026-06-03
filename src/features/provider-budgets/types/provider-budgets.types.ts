export interface ProviderSentBudget {
  id: string;
  proposed_amount: number;
  proposal_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
  photos: string[];
  client_rejection_response: string | null;
  service_request_id: string;
  service_request_title: string;
  service_request_description: string | null;
  service_request_photos: string[] | null;
  service_request_urgency: string | null;
  service_request_status: string | null;
  service_request_created_at: string;
  service_title: string;
  service_slug: string;
  service_icon_key: string | null;
  service_color_key: string | null;
  neighborhood: string | null;
  city: string | null;
  state_abbr: string | null;
  masked_client_name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
}

export type BudgetStatusFilter = "submitted" | "accepted" | "rejected";

/** Default filter on the sent budgets list (no "All" option). */
export const DEFAULT_BUDGET_STATUS_FILTER: BudgetStatusFilter = "submitted";
