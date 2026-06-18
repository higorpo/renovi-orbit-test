import type { ListProviderOpportunityItem } from "../../types/provider-jobs.types";

export function createMinimalJob(
  overrides: Partial<ListProviderOpportunityItem> = {},
): ListProviderOpportunityItem {
  return {
    service_request_id: "job-1",
    title: "Instalar tomada",
    service_name: "Elétrica",
    service_icon_key: "Zap",
    service_color_key: "yellow_orange",
    neighborhood: "Centro",
    urgency: "medium",
    granted_at: "2026-03-20T12:00:00.000Z",
    distance_km: 2.5,
    active_chat_count_24h: 1,
    source: "batch",
    ...overrides,
  };
}
