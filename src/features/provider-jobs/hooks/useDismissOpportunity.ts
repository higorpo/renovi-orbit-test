import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { dismissProviderOpportunity } from "../api/dismissOpportunity.api";
import { PROVIDER_JOBS_LIST_QUERY_KEY } from "../constants/queryKeys";
import type { ProviderJobsResponse } from "../types/provider-jobs.types";

type ProviderJobsInfiniteData = InfiniteData<ProviderJobsResponse>;

function removeJobFromInfinitePages(
  data: ProviderJobsInfiniteData | undefined,
  serviceRequestId: string,
): ProviderJobsInfiniteData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter(
        (item) => item.service_request_id !== serviceRequestId,
      ),
    })),
  };
}

export function useDismissOpportunity() {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();

  const mutation = useMutation({
    mutationFn: async (serviceRequestId: string) => {
      const result = await dismissProviderOpportunity(serviceRequestId);
      if (result.error) {
        throw new Error(result.error);
      }
      return serviceRequestId;
    },
    onMutate: async (serviceRequestId) => {
      await queryClient.cancelQueries({ queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY] });

      const previousEntries = queryClient.getQueriesData<ProviderJobsInfiniteData>({
        queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY],
      });

      queryClient.setQueriesData<ProviderJobsInfiniteData>(
        { queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY] },
        (old) => removeJobFromInfinitePages(old, serviceRequestId),
      );

      return { previousEntries };
    },
    onSuccess: (serviceRequestId) => {
      trackEvent("provider_opportunity_dismissed", {
        service_request_id: serviceRequestId,
      });
      void queryClient.invalidateQueries({ queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY] });
    },
    onError: (_error, _serviceRequestId, context) => {
      context?.previousEntries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Não foi possível ocultar esta oportunidade. Tente novamente.");
    },
  });

  return {
    dismissOpportunity: mutation.mutate,
    dismissingId: mutation.isPending ? mutation.variables : null,
    isDismissing: mutation.isPending,
  };
}
