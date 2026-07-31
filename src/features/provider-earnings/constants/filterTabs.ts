import type {
  SettlementFilterConfig,
  SettlementFilterId,
} from "../types/settlements.types";

export const SETTLEMENT_FILTER_TABS: SettlementFilterConfig[] = [
  { id: "all", label: "Todos", movementStatus: null, recordType: null },
  { id: "pending", label: "Previsto", movementStatus: "PENDING", recordType: null },
  { id: "paid_out", label: "Liquidado", movementStatus: "PAID_OUT", recordType: null },
  { id: "debit", label: "Estorno", movementStatus: null, recordType: "DEBIT" },
];

export const DEFAULT_SETTLEMENT_FILTER_ID: SettlementFilterId = "all";

export function getSettlementFilterConfig(filterId: SettlementFilterId): SettlementFilterConfig {
  return (
    SETTLEMENT_FILTER_TABS.find((tab) => tab.id === filterId) ?? SETTLEMENT_FILTER_TABS[0]
  );
}
