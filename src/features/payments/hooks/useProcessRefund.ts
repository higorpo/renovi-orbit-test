import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "@/features/chats";
import {
  processContractedServiceRefund,
  type ProcessRefundSuccess,
} from "../api/refund.api";
import { PAYMENT_SCHEDULE_QUERY_KEY } from "./usePaymentSchedule";
import { PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY } from "./usePaymentScheduleLifecycle";

export type ProcessRefundRequest = {
  contractedServiceId: string;
  cancellationReason?: string;
};

export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ProcessRefundRequest): Promise<ProcessRefundSuccess> => {
      const result = await processContractedServiceRefund(request);
      if (result.error || !result.data) {
        const error = new Error(
          result.error ??
            "Não foi possível processar o cancelamento/reembolso. Tente novamente.",
        );
        (error as Error & { errorCode?: string; status?: number; supportUrl?: string }).errorCode =
          result.errorCode;
        (error as Error & { status?: number }).status = result.status;
        (error as Error & { supportUrl?: string }).supportUrl = result.supportUrl;
        throw error;
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...PAYMENT_SCHEDULE_QUERY_KEY, variables.contractedServiceId],
      });
      void queryClient.invalidateQueries({ queryKey: PAYMENT_SCHEDULE_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: [...PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY, variables.contractedServiceId],
      });
      void queryClient.invalidateQueries({ queryKey: PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CONVERSATION_DETAIL_QUERY_KEY] });
    },
  });
}
