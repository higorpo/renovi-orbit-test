/**
 * Provider earnings feature — Public API (Ganhos / bank settlements).
 *
 * External consumers import from `@/features/provider-earnings` only.
 * Internal modules (api/, hooks/, components/, utils/) must not be imported across features.
 */

// Page — router lazy-loads the file path; export kept for typed consumers
export { EarningsPage } from "./components/EarningsPage";

// Cross-feature disclosure (payments Recebimentos / contracted-service status)
export { ProviderSettlementDisclosure } from "./components/ProviderSettlementDisclosure";
export type { ProviderSettlementDisclosureProps } from "./components/ProviderSettlementDisclosure";

// Shared copy + hold resolution used by payments (Recebimentos / service detail)
export {
  PROVIDER_SETTLEMENT_COMPLETION_NOTE,
  resolveProviderSettlementHold,
} from "./utils/providerSettlementDisclosure";
export type {
  ProviderSettlementHoldReason,
  ResolveProviderSettlementHoldInput,
  ResolveProviderSettlementHoldResult,
} from "./utils/providerSettlementDisclosure";

// Routes & query keys
export { ROUTE_PROVIDER_EARNINGS } from "./constants/routes";
export {
  PROVIDER_SETTLEMENTS_QUERY_KEY,
  providerSettlementsQueryKey,
} from "./constants/queryKeys";
