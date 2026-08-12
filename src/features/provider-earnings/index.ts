/**
 * Provider earnings feature — Public API (Ganhos / bank settlements).
 *
 * External consumers import from `@/features/provider-earnings` only.
 * Internal modules (api/, hooks/, components/, utils/) must not be imported across features.
 */

export { EarningsPage } from "./components/EarningsPage";
export { EarningsLedgerSwitch } from "./components/EarningsLedgerSwitch";
export type {
  EarningsLedgerSwitchProps,
  EarningsLedgerSummary,
} from "./components/EarningsLedgerSwitch";

export { ProviderSettlementDisclosure } from "./components/ProviderSettlementDisclosure";
export type { ProviderSettlementDisclosureProps } from "./components/ProviderSettlementDisclosure";

export {
  PROVIDER_SETTLEMENT_COMPLETION_NOTE,
  resolveProviderSettlementHold,
} from "./utils/providerSettlementDisclosure";
export type {
  ProviderSettlementHoldReason,
  ResolveProviderSettlementHoldInput,
  ResolveProviderSettlementHoldResult,
} from "./utils/providerSettlementDisclosure";

export { useProviderSettlements } from "./hooks/useProviderSettlements";
export { useEarningsViewParam } from "./hooks/useEarningsViewParam";

export {
  EARNINGS_VIEW,
  DEFAULT_EARNINGS_VIEW,
  EARNINGS_VIEW_SEARCH_PARAM,
  parseEarningsView,
} from "./constants/earningsView";
export type { EarningsView } from "./constants/earningsView";

export { ROUTE_PROVIDER_EARNINGS, providerEarningsPath } from "./constants/routes";
export {
  PROVIDER_SETTLEMENTS_QUERY_KEY,
  providerSettlementsQueryKey,
} from "./constants/queryKeys";
