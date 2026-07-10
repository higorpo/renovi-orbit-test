import { useQuery } from "@tanstack/react-query";
import { getCheckoutStepRequirements } from "../api/checkout.api";
import type { CheckoutStepRequirements } from "../types/checkoutStepper.types";

export const CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY = ["checkout-step-requirements"];

const DEFAULT_REQUIREMENTS: CheckoutStepRequirements = {
  needs_cpf: true,
  needs_phone: true,
  needs_card: true,
};

export type UseCheckoutStepRequirementsOptions = {
  enabled?: boolean;
};

export function useCheckoutStepRequirements(
  options: UseCheckoutStepRequirementsOptions = {},
) {
  const query = useQuery({
    queryKey: CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getCheckoutStepRequirements();
      if (result.error || !result.data) {
        throw new Error(result.error ?? "checkout_step_requirements_unavailable");
      }
      return result.data;
    },
    enabled: options.enabled !== false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  return {
    requirements: query.data ?? DEFAULT_REQUIREMENTS,
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
