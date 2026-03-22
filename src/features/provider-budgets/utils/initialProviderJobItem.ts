import type { ProviderJobItem } from "@/features/provider-jobs/types/provider-jobs.types";
import { MAX_PROPOSALS_PER_REQUEST } from "@/features/provider-jobs/types/provider-jobs.types";
import type {
  ProviderOwnQuestion,
  ProviderSentBudget,
} from "../types/provider-budgets.types";

/**
 * Preenche `ProviderJobItem` a partir do card de orçamento para usar como `initialData`
 * no detalhe (sheet) — campos ausentes na RPC de orçamentos usam placeholders seguros.
 */
export function initialProviderJobItemFromSentBudget(
  budget: ProviderSentBudget,
): ProviderJobItem {
  return {
    id: budget.service_request_id,
    title: budget.service_request_title,
    description: budget.service_request_description,
    service_id: "",
    service_title: budget.service_title,
    service_slug: budget.service_slug,
    service_icon_key: budget.service_icon_key,
    service_color_key: budget.service_color_key,
    service_parent_id: null,
    photos: budget.service_request_photos,
    form_data: null,
    form_schema: null,
    urgency: budget.service_request_urgency,
    scope_complexity: null,
    estimated_duration_hint: null,
    tags: null,
    suggested_questions: null,
    suggested_equipment: null,
    suggested_materials: null,
    masked_client_name: budget.masked_client_name,
    neighborhood: budget.neighborhood ?? "",
    city: budget.city ?? "",
    state: budget.state_abbr ?? "",
    distance_km: 0,
    proposal_count: MAX_PROPOSALS_PER_REQUEST,
    provider_proposal_id: budget.id,
    provider_proposed_amount: budget.proposed_amount,
    provider_tax_rate: budget.tax_rate,
    provider_tax_amount: budget.tax_amount,
    provider_final_amount: budget.final_amount,
    provider_proposal_description: budget.proposal_description,
    provider_proposal_duration_value: null,
    provider_proposal_duration_unit: null,
    provider_proposal_suggested_slots: null,
    provider_proposal_photos: budget.photos?.length ? budget.photos : null,
    provider_proposal_status: budget.status,
    provider_proposal_client_rejection_response: budget.client_rejection_response,
    exact_area_match: false,
    created_at: budget.service_request_created_at,
  };
}

/**
 * Versão para card de pergunta (sem dados do orçamento no payload).
 */
export function initialProviderJobItemFromOwnQuestion(
  question: ProviderOwnQuestion,
): ProviderJobItem {
  return {
    id: question.service_request_id,
    title: question.service_request_title,
    description: question.service_request_description,
    service_id: "",
    service_title: question.service_title,
    service_slug: question.service_slug,
    service_icon_key: question.service_icon_key,
    service_color_key: question.service_color_key,
    service_parent_id: null,
    photos: question.service_request_photos,
    form_data: null,
    form_schema: null,
    urgency: question.service_request_urgency,
    scope_complexity: null,
    estimated_duration_hint: null,
    tags: null,
    suggested_questions: null,
    suggested_equipment: null,
    suggested_materials: null,
    masked_client_name: question.masked_client_name,
    neighborhood: question.neighborhood ?? "",
    city: question.city ?? "",
    state: question.state_abbr ?? "",
    distance_km: 0,
    proposal_count: MAX_PROPOSALS_PER_REQUEST,
    provider_proposal_id: null,
    provider_proposed_amount: null,
    provider_tax_rate: null,
    provider_tax_amount: null,
    provider_final_amount: null,
    provider_proposal_description: null,
    provider_proposal_duration_value: null,
    provider_proposal_duration_unit: null,
    provider_proposal_suggested_slots: null,
    provider_proposal_photos: null,
    provider_proposal_status: null,
    provider_proposal_client_rejection_response: null,
    exact_area_match: false,
    created_at: question.service_request_created_at,
  };
}
