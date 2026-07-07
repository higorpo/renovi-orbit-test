import { useQuery } from "@tanstack/react-query";
import { fetchPaymentScheduleLifecycleByContractedService } from "../api/charges.api";

export const PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY = ["payment-schedule-lifecycle"];

export function usePaymentScheduleLifecycle(contractedServiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY, contractedServiceId],
    queryFn: async () => {
      const result = await fetchPaymentScheduleLifecycleByContractedService(contractedServiceId!);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: enabled && Boolean(contractedServiceId),
    staleTime: 15_000,
  });
}
