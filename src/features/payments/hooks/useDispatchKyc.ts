import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatchKycEmail, type DispatchKycRequest } from "../api/kyc.api";
import { PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY } from "./useProviderPaymentAccount";

export function useDispatchKyc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DispatchKycRequest) => {
      const result = await dispatchKycEmail(request);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Falha ao enviar credenciamento");
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY });
    },
  });
}
