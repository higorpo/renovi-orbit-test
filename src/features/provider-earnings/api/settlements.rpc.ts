/**
 * Provider earnings RPC names — local to provider-earnings.
 * Settlement list is owned by the payment backend; do not import payments internals.
 */
export const PROVIDER_EARNINGS_RPC = {
  listSettlementMovements: "list_provider_settlement_movements",
} as const;

export type ProviderEarningsRpcName =
  (typeof PROVIDER_EARNINGS_RPC)[keyof typeof PROVIDER_EARNINGS_RPC];
