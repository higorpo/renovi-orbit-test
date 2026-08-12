import type { SettlementFilterId } from "../types/settlements.types";

export const PROVIDER_SETTLEMENTS_QUERY_KEY = ["provider-earnings", "provider-settlements"] as const;

export function providerSettlementsQueryKey(
  filterId: SettlementFilterId,
  settlingFrom?: string | null,
  settlingTo?: string | null,
) {
  return [...PROVIDER_SETTLEMENTS_QUERY_KEY, filterId, settlingFrom ?? null, settlingTo ?? null] as const;
}
