import {
  summarizeProviderReceivables,
  useProviderPaymentHistory,
} from "@/features/payments";
import { useProviderSettlements } from "@/features/provider-earnings";

export function useEarningsLedgerSummary() {
  const receivablesQuery = useProviderPaymentHistory();
  const settlementsQuery = useProviderSettlements({ filterId: "all" });
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
