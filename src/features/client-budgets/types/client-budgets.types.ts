export interface PaginatedResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
}

export type ClientBudgetsTab = "recebidos" | "perguntas";

export type ReceivedStatusFilter =
  | "awaiting_decision"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "closed";

export type QuestionStatusFilter = "pending" | "answered" | "closed";

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
  withdrawn_count: number;
  budgets_preview: BudgetPreviewItem[];
}

export interface QuestionPreviewItem {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string | null;
  provider_profile_image_path: string | null;
  question: string;
  client_response: string | null;
  client_response_images: string[];
  created_at: string;
  client_responded_at: string | null;
}

export interface ClientQuestionServiceGroup {
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
  total_questions: number;
  pending_questions_count: number;
  answered_questions_count: number;
  latest_question_at: string | null;
  questions_preview: QuestionPreviewItem[];
}

/** Orçamento completo no detalhe do pedido (inclui texto, fotos e prazo de resposta do cliente). */
export interface ClientBudgetDetailProposal extends BudgetPreviewItem {
  proposal_description: string;
  photos: string[];
  /** Prazo para o cliente aprovar/recusar enquanto status = submitted (ex.: created_at + 48h). */
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
  questions: QuestionPreviewItem[];
}
