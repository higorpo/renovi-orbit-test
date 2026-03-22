import type {
  ProviderOwnQuestion,
  ProviderSentBudget,
} from "../../types/provider-budgets.types";

export function createProviderSentBudget(
  overrides: Partial<ProviderSentBudget> = {},
): ProviderSentBudget {
  return {
    id: "proposal-1",
    proposed_amount: 150,
    proposal_description: "Serviço completo",
    status: "submitted",
    created_at: "2024-01-15T12:00:00.000Z",
    updated_at: "2024-01-15T12:00:00.000Z",
    tax_rate: 0.05,
    tax_amount: 7.5,
    final_amount: 157.5,
    photos: [],
    client_rejection_response: null,
    service_request_id: "sr-1",
    service_request_title: "Instalar tomada",
    service_request_description: "Na cozinha",
    service_request_photos: null,
    service_request_urgency: "normal",
    service_request_status: "open",
    service_request_created_at: "2024-01-10T10:00:00.000Z",
    service_title: "Elétrica",
    service_slug: "eletrica",
    service_icon_key: "bolt",
    service_color_key: "amber",
    neighborhood: "Centro",
    city: "Florianópolis",
    state_abbr: "SC",
    masked_client_name: "João S.",
    ...overrides,
  };
}

export function createProviderOwnQuestion(
  overrides: Partial<ProviderOwnQuestion> = {},
): ProviderOwnQuestion {
  return {
    id: "q-1",
    question: "Qual o prazo?",
    client_response: null,
    created_at: "2024-01-14T11:00:00.000Z",
    client_responded_at: null,
    service_request_id: "sr-2",
    service_request_title: "Pintura",
    service_request_description: null,
    service_request_photos: null,
    service_request_urgency: null,
    service_request_status: "open",
    service_request_created_at: "2024-01-12T09:00:00.000Z",
    service_title: "Pintura",
    service_slug: "pintura",
    service_icon_key: null,
    service_color_key: null,
    neighborhood: null,
    city: null,
    state_abbr: null,
    masked_client_name: "Maria L.",
    has_proposal: false,
    ...overrides,
  };
}
