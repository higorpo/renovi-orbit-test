import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  manualChargePayment,
  type ManualChargePaymentRequest,
  type ManualChargePaymentSuccess,
} from "../api/charges.api";
import { PAYMENT_SCHEDULE_QUERY_KEY } from "./usePaymentSchedule";

export function useManualChargePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ManualChargePaymentRequest): Promise<ManualChargePaymentSuccess> => {
      const result = await manualChargePayment(request);
      if (result.error || !result.data) {
        const error = new Error(result.error ?? "Falha ao processar pagamento");
        (error as Error & { errorCode?: string; status?: number }).errorCode = result.errorCode;
        (error as Error & { status?: number }).status = result.status;
        throw error;
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PAYMENT_SCHEDULE_QUERY_KEY });
    },
  });
}
