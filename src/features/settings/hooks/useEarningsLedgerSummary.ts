import {
  summarizeProviderReceivables,
  useProviderPaymentHistory,
} from "@/features/payments";
import { useProviderSettlements } from "@/features/provider-earnings";

export type UseEarningsLedgerSummaryParams = {
  receivedFrom?: string | null;
  receivedTo?: string | null;
  settlingFrom?: string | null;
  settlingTo?: string | null;
};

export function useEarningsLedgerSummary(params: UseEarningsLedgerSummaryParams = {}) {
  const receivablesQuery = useProviderPaymentHistory({
    receivedFrom: params.receivedFrom,
    receivedTo: params.receivedTo,
  });
  const settlementsQuery = useProviderSettlements({
    filterId: "all",
    settlingFrom: params.settlingFrom,
    settlingTo: params.settlingTo,
  });
  const summary = summarizeProviderReceivables(receivablesQuery.data ?? []);

  return {
    agreedTotal: summary.agreedTotal,
    netTotal: summary.netTotal,
    hasClawback: summary.hasClawback,
    depositCount: settlementsQuery.totalCount,
    isLoadingReceivables: receivablesQuery.isLoading,
    isLoadingDeposits: settlementsQuery.isLoading,
    isErrorReceivables: receivablesQuery.isError,
    isErrorDeposits: settlementsQuery.isError,
  };
}
