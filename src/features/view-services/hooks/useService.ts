import { useQuery } from "@tanstack/react-query";
import { getServiceById } from "../api/services.api";
import { SERVICE_DETAIL_QUERY_KEY } from "../constants/queryKeys";

export function useService(serviceRequestId: string | undefined) {
  const id = serviceRequestId?.trim() ?? "";

  return useQuery({
    queryKey: [...SERVICE_DETAIL_QUERY_KEY, id],
    queryFn: async () => {
      const result = await getServiceById(id);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
