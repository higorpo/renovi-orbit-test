import type {
  SettlementFilterConfig,
  SettlementFilterId,
} from "../types/settlements.types";

export const SETTLEMENT_FILTER_TABS: SettlementFilterConfig[] = [
  // CREDIT only — clawed-back / refunded receivables are excluded by the list RPC.
  { id: "all", label: "Todos", movementStatus: null, recordType: "CREDIT" },
  { id: "pending", label: "Previsto", movementStatus: "PENDING", recordType: "CREDIT" },
  { id: "paid_out", label: "Liquidado", movementStatus: "PAID_OUT", recordType: "CREDIT" },
];

export const DEFAULT_SETTLEMENT_FILTER_ID: SettlementFilterId = "all";

export function getSettlementFilterConfig(filterId: SettlementFilterId): SettlementFilterConfig {
  return (
    SETTLEMENT_FILTER_TABS.find((tab) => tab.id === filterId) ?? SETTLEMENT_FILTER_TABS[0]
  );
}
