import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { fetchClientCpf } from "../api/clientCpf.api";

export const PAYMENT_CLIENT_CPF_QUERY_KEY = ["payment-client-cpf"];

export function useClientCpfForPayment() {
  const { user, profile } = useAuth();
  const clientId = user?.id ?? null;
  const isClient = profile?.role === "client";

  const query = useQuery({
    queryKey: [...PAYMENT_CLIENT_CPF_QUERY_KEY, clientId],
    queryFn: async () => {
      const result = await fetchClientCpf(clientId!);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.cpf;
    },
    enabled: Boolean(clientId && isClient),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return {
    cpf: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
