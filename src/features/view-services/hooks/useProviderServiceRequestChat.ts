import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import {
  findProviderChatForServiceRequest,
  PROVIDER_SERVICE_CHAT_QUERY_KEY,
} from "@/features/chats";

export function useProviderServiceRequestChat(serviceRequestId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: [PROVIDER_SERVICE_CHAT_QUERY_KEY, serviceRequestId],
    queryFn: async () => {
      const result = await findProviderChatForServiceRequest(serviceRequestId!);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: Boolean(serviceRequestId) && profile?.role === "provider",
  });
}
