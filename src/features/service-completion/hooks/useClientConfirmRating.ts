import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import {
  confirmServiceCompleted,
  type ConfirmServiceCompletedSuccess,
} from "../api/lifecycle.api";
import { submitServiceRating } from "../api/ratings.api";
import type { ServiceRatingScores } from "../api/ratings.api";
import { serviceCompletionContextQueryKey } from "./queryKeys";

export type ClientConfirmRatingMode = "confirm_with_rating" | "optional_rating";

export type UseClientConfirmRatingOptions = {
  serviceRequestId: string;
  contractedServiceId: string;
  mode: ClientConfirmRatingMode;
};

export function useClientConfirmRating({
  serviceRequestId,
  contractedServiceId,
  mode,
}: UseClientConfirmRatingOptions) {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const idempotencyKeyRef = useRef<string | null>(null);

  const ensureIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  };

  const mutation = useMutation({
    mutationFn: async (
      scores: ServiceRatingScores,
    ): Promise<ConfirmServiceCompletedSuccess | { ratingId: string | null }> => {
      if (mode === "confirm_with_rating") {
        const result = await confirmServiceCompleted({
          contractedServiceId,
          scores,
          idempotencyKey: ensureIdempotencyKey(),
        });
        if (result.error || !result.data) {
          metrics.count("service_completion.confirm_rating_fail", 1, {
            code: result.errorCode ?? "unknown",
          });
          const error = new Error(
            result.error ?? "Falha ao confirmar recebimento",
          );
          (error as Error & { errorCode?: string }).errorCode = result.errorCode;
          throw error;
        }
        metrics.count("service_completion.confirm_rating_ok", 1);
        return result.data;
      }

      const result = await submitServiceRating(contractedServiceId, scores);
      if (result.error) {
        metrics.count("service_completion.optional_rating_fail", 1);
        throw new Error(result.error);
      }
      metrics.count("service_completion.optional_rating_ok", 1);
      return { ratingId: result.ratingId };
    },
    onSuccess: (_data, scores) => {
      if (mode === "confirm_with_rating") {
        idempotencyKeyRef.current = null;
        trackEvent("service_completion_confirm_rating_completed", {
          contracted_service_id: contractedServiceId,
          has_comment: Boolean(scores.comment?.trim()),
        });
        toast.success("Recebimento confirmado. Obrigado pela avaliação!");
      } else {
        trackEvent("service_completion_optional_rating_submitted", {
          contracted_service_id: contractedServiceId,
        });
        toast.success("Avaliação enviada. Obrigado!");
      }
      void queryClient.invalidateQueries({
        queryKey: serviceCompletionContextQueryKey(serviceRequestId),
      });
    },
    onError: (error: Error) => {
      logger.warn("client_confirm_rating_failed", {
        contractedServiceId,
        mode,
        error: error.message,
      });
      trackEvent("service_completion_confirm_rating_failed", {
        mode,
        reason: error.message.slice(0, 80),
      });
      toast.error(error.message);
    },
  });

  return mutation;
}
