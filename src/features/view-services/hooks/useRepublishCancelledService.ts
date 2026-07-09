import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { addBreadcrumb, metrics } from "@/lib/sentry";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { republishCancelledServiceRequest } from "../api/services.api";
import { SERVICE_DETAIL_QUERY_KEY, SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";
import { getServiceDetailPath } from "../constants/routes";

export function useRepublishCancelledService() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const idempotencyKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (serviceRequestId: string) => {
      const idempotencyKey = idempotencyKeyRef.current ?? generateIdempotencyKeyV7();
      idempotencyKeyRef.current = idempotencyKey;

      addBreadcrumb({
        message: "view_services.republish_cancelled_started",
        data: { service_request_id: serviceRequestId },
      });

      const result = await republishCancelledServiceRequest(serviceRequestId, idempotencyKey);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Não foi possível republicar o pedido.");
      }

      idempotencyKeyRef.current = null;
      return result.data;
    },
    onSuccess: (data, sourceRequestId) => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: [...SERVICE_DETAIL_QUERY_KEY, sourceRequestId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...SERVICE_DETAIL_QUERY_KEY, data.requestId],
      });

      trackEvent("cancelled_service_republished", {
        source_service_request_id: sourceRequestId,
        new_service_request_id: data.requestId,
      });
      metrics.count("view_services.cancelled_service_republished", 1);
      addBreadcrumb({
        message: "view_services.republish_cancelled_succeeded",
        data: {
          source_service_request_id: sourceRequestId,
          new_service_request_id: data.requestId,
        },
      });

      toast.success("Novo pedido de serviço publicado.");
      navigate(getServiceDetailPath(data.requestId));
    },
    onError: (error) => {
      addBreadcrumb({
        message: "view_services.republish_cancelled_failed",
        level: "error",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      toast.error("Não foi possível republicar o pedido. Tente novamente.");
    },
  });

  return {
    republishCancelledService: mutation.mutate,
    isRepublishing: mutation.isPending,
  };
}
