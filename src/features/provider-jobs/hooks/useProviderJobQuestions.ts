import { useQuery } from "@tanstack/react-query";
import { listProviderJobQuestions } from "../api/providerJobQuestions.api";

const STALE_TIME_MS = 30_000;

export function useProviderJobQuestions(serviceRequestId: string | undefined) {
  const query = useQuery({
    queryKey: ["provider-job-questions", serviceRequestId],
    enabled: Boolean(serviceRequestId),
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const { data, error } = await listProviderJobQuestions(serviceRequestId!);
      if (error || !data) {
        throw new Error(error ?? "Erro ao carregar perguntas");
      }
      return data;
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
