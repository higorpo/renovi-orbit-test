import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dispatchKycEmail,
  submitProviderKyc,
  type DispatchKycRequest,
} from "../api/kyc.api";
import { PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY } from "./useProviderPaymentAccount";

export function useDispatchKyc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DispatchKycRequest) => {
      const submitResult = await submitProviderKyc({
        bankInstitutionCode: request.bankInstitutionCode,
        bankBranch: request.bankBranch,
        bankAccount: request.bankAccount,
        identityDocStoragePath: request.identityDocStoragePath,
        addressProofStoragePath: request.addressProofStoragePath,
        pixKey: request.pixKey,
        phone: request.phone,
        legalRepresentativePhone: request.legalRepPhone,
        corporateCharterStoragePath: request.corporateCharterStoragePath,
        legalRepDocStoragePath: request.legalRepDocStoragePath,
      });

      if (submitResult.error || !submitResult.data) {
        if (submitResult.errorCode !== "INVALID_ONBOARDING_STATE") {
          throw new Error(submitResult.error ?? "Falha ao salvar credenciamento");
        }
      }

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
