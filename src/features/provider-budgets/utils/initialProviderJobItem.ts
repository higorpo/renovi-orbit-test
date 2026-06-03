import type { ProviderJobItem } from "@/features/provider-jobs/types/provider-jobs.types";
import type { ProviderSentBudget } from "../types/provider-budgets.types";

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
    suggested_equipment: null,
    suggested_materials: null,
    masked_client_name: budget.masked_client_name,
    neighborhood: budget.neighborhood ?? "",
    city: budget.city ?? "",
    state: budget.state_abbr ?? "",
    distance_km: 0,
    proposal_count: 1,
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
    is_latest_provider_proposal: true,
    exact_area_match: false,
    created_at: budget.service_request_created_at,
  };
}
