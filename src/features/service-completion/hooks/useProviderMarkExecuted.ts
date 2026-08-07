import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import {
  SERVICE_DETAIL_QUERY_KEY,
  SERVICES_LIST_QUERY_KEY,
} from "@/features/view-services";
import {
  markServiceExecuted,
  type MarkServiceExecutedSuccess,
} from "../api/lifecycle.api";
import { serviceCompletionContextQueryKey } from "./queryKeys";
import type { CompletionResponsesMap } from "../types/completion.types";

export type ProviderMarkExecutedInput = {
  serviceRequestId: string;
  contractedServiceId: string;
  responses: CompletionResponsesMap;
  expectedDraftVersion?: number | null;
};

/**
 * Final EXECUTED submit with a stable per-mount idempotency key (double-tap safe).
 */
export function useProviderMarkExecuted() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  const ensureIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  };

  const mutation = useMutation({
    mutationFn: async (
      input: ProviderMarkExecutedInput,
    ): Promise<MarkServiceExecutedSuccess> => {
      const result = await markServiceExecuted({
        contractedServiceId: input.contractedServiceId,
        responses: input.responses,
        idempotencyKey: ensureIdempotencyKey(),
        expectedDraftVersion: input.expectedDraftVersion ?? null,
      });

      if (result.error || !result.data) {
        metrics.count("service_completion.mark_executed_fail", 1, {
          code: result.errorCode ?? "unknown",
        });
        logger.warn("provider_mark_executed_failed", {
          contractedServiceId: input.contractedServiceId,
          errorCode: result.errorCode,
        });
        const error = new Error(
          result.error ?? "Falha ao marcar serviço como executado",
        );
        (error as Error & { errorCode?: string }).errorCode = result.errorCode;
        throw error;
      }

      metrics.count("service_completion.mark_executed_ok", 1, {
        idempotent: result.data.idempotent ? "1" : "0",
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      // New attempt key after success so a later retry (unlikely) is a new op.
      idempotencyKeyRef.current = null;
      void queryClient.invalidateQueries({
        queryKey: serviceCompletionContextQueryKey(variables.serviceRequestId),
      });
      // Refresh Meus Serviços / detail for every host (list card, detail).
      void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SERVICE_DETAIL_QUERY_KEY });
      // Success UI lives in CompletionSuccessStep (sheet stays open).
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    ...mutation,
    /** Peek current idempotency key (creates one if missing). */
    getIdempotencyKey: ensureIdempotencyKey,
  };
}
