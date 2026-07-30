import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryProviderKycEmailDispatch } from "../api/kyc.api";
import { PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY } from "./useProviderPaymentAccount";

const RETRY_INTERVAL_MS = 15_000;

export function useRetryKycEmailDispatch(enabled: boolean) {
  const queryClient = useQueryClient();
  const isPendingRef = useRef(false);

  const { mutate } = useMutation({
    mutationFn: retryProviderKycEmailDispatch,
    onSuccess: (result) => {
      if (result.data?.emailDispatched) {
        void queryClient.invalidateQueries({ queryKey: PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY });
      }
    },
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const dispatch = () => {
      if (isPendingRef.current) {
        return;
      }

      isPendingRef.current = true;
      mutate(undefined, {
        onSettled: () => {
          isPendingRef.current = false;
        },
      });
    };

    dispatch();
    const intervalId = window.setInterval(dispatch, RETRY_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, mutate]);

  return null;
}
