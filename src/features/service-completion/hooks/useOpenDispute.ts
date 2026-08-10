import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import {
  SERVICE_DETAIL_QUERY_KEY,
  SERVICES_LIST_QUERY_KEY,
} from "@/features/view-services";
import {
  openDispute,
  type OpenDisputeSuccess,
} from "../api/lifecycle.api";
import { serviceCompletionContextQueryKey } from "./queryKeys";

export const DISPUTE_OPENED_ANALYTICS_EVENT =
  "service_completion_dispute_opened";
export const DISPUTE_OPEN_FAILED_ANALYTICS_EVENT =
  "service_completion_dispute_open_failed";

export type UseOpenDisputeOptions = {
  serviceRequestId: string;
  contractedServiceId: string;
  onOpened?: (data: OpenDisputeSuccess) => void;
};

export type OpenDisputeMutationInput = {
  reason?: string | null;
};

/**
 * Opens a service dispute (EXECUTED → IN_DISPUTE) via RPC.
 * Invalidates list/detail/completion context; callers close the evaluate wizard.
 */
export function useOpenDispute({
  serviceRequestId,
  contractedServiceId,
  onOpened,
}: UseOpenDisputeOptions) {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();

  return useMutation({
    mutationFn: async (
      input: OpenDisputeMutationInput = {},
    ): Promise<OpenDisputeSuccess> => {
      const result = await openDispute({
        contractedServiceId,
        reason: input.reason,
      });
      if (result.error || !result.data) {
        metrics.count("service_completion.open_dispute_fail", 1, {
          code: result.errorCode ?? "unknown",
        });
        const error = new Error(result.error ?? "Falha ao abrir disputa");
        (error as Error & { errorCode?: string }).errorCode = result.errorCode;
        throw error;
      }
      metrics.count("service_completion.open_dispute_ok", 1);
      return result.data;
    },
    onSuccess: (data, variables) => {
      trackEvent(DISPUTE_OPENED_ANALYTICS_EVENT, {
        contracted_service_id: contractedServiceId,
        has_reason: Boolean(variables.reason?.trim()),
      });
      toast.success("Disputa aberta", {
        description:
          "A plataforma vai analisar o caso.",
      });
      void queryClient.invalidateQueries({
        queryKey: serviceCompletionContextQueryKey(serviceRequestId),
      });
      void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SERVICE_DETAIL_QUERY_KEY });
      onOpened?.(data);
    },
    onError: (error: Error) => {
      logger.warn("client_open_dispute_failed", {
        contractedServiceId,
        error: error.message,
      });
      trackEvent(DISPUTE_OPEN_FAILED_ANALYTICS_EVENT, {
        contracted_service_id: contractedServiceId,
        reason: error.message.slice(0, 80),
      });
      toast.error(error.message);
    },
  });
}
