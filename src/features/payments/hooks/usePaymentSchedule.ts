import { useQuery } from "@tanstack/react-query";
import {
  fetchContractedServicePaymentContext,
  fetchPaymentScheduleByContractedService,
} from "../api/charges.api";

export const PAYMENT_SCHEDULE_QUERY_KEY = ["payment-schedule"];

export function usePaymentSchedule(contractedServiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...PAYMENT_SCHEDULE_QUERY_KEY, contractedServiceId],
    queryFn: async () => {
      const [scheduleResult, contextResult] = await Promise.all([
        fetchPaymentScheduleByContractedService(contractedServiceId!),
        fetchContractedServicePaymentContext(contractedServiceId!),
      ]);

      if (scheduleResult.error) {
        throw new Error(scheduleResult.error);
      }

      if (contextResult.error) {
        throw new Error(contextResult.error);
      }

      return {
        schedule: scheduleResult.data,
        context: contextResult.data,
      };
    },
    enabled: enabled && Boolean(contractedServiceId),
    staleTime: 15_000,
  });
}
