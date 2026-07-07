import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCheckoutStepRequirements } from "../api/checkout.api";
import type {
  CheckoutStepData,
  CheckoutStepId,
  CheckoutStepRequirements,
} from "../types/checkoutStepper.types";
import { generateClearSaleSessionId } from "../utils/generateClearSaleSessionId";
import { resolveCheckoutSteps } from "../utils/resolveCheckoutSteps";

export const CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY = ["checkout-step-requirements"];

const DEFAULT_REQUIREMENTS: CheckoutStepRequirements = {
  needs_cpf: true,
  needs_phone: true,
  needs_card: true,
};

export type UseCheckoutStepperOptions = {
  enabled?: boolean;
};

export function useCheckoutStepper(options: UseCheckoutStepperOptions = {}) {
  const queryClient = useQueryClient();
  const [stepData, setStepData] = useState<CheckoutStepData>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [clearsaleSessionId, setClearsaleSessionIdState] = useState<string | null>(null);
  const [sessionSteps, setSessionSteps] = useState<CheckoutStepId[] | null>(null);

  const requirementsQuery = useQuery({
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

  const requirements = requirementsQuery.data ?? DEFAULT_REQUIREMENTS;

  const resolvedSteps = useMemo(
    () => resolveCheckoutSteps(requirements),
    [requirements],
  );

  useEffect(() => {
    if (
      sessionSteps === null
      && !requirementsQuery.isLoading
      && !requirementsQuery.isError
      && requirementsQuery.data
    ) {
      setSessionSteps(resolveCheckoutSteps(requirementsQuery.data));
    }
  }, [
    sessionSteps,
    requirementsQuery.isLoading,
    requirementsQuery.isError,
    requirementsQuery.data,
  ]);

  useEffect(() => {
    if (options.enabled === false) {
      setSessionSteps(null);
    }
  }, [options.enabled]);

  const steps = sessionSteps ?? resolvedSteps;

  const currentStep: CheckoutStepId = steps[currentStepIndex] ?? steps[0] ?? "card";

  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(Math.max(steps.length - 1, 0));
    }
  }, [currentStepIndex, steps.length]);

  const setClearsaleSessionId = useCallback((sessionId: string) => {
    setClearsaleSessionIdState(sessionId);
  }, []);

  const ensureClearsaleSessionId = useCallback((): string => {
    if (clearsaleSessionId) {
      return clearsaleSessionId;
    }
    const sessionId = generateClearSaleSessionId();
    setClearsaleSessionIdState(sessionId);
    return sessionId;
  }, [clearsaleSessionId]);

  const goNext = useCallback(() => {
    setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }, [steps.length]);

  const goBack = useCallback(() => {
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  const updateStepData = useCallback((patch: Partial<CheckoutStepData>) => {
    setStepData((previous) => ({ ...previous, ...patch }));
  }, []);

  const completeStep = useCallback(
    (patch: Partial<CheckoutStepData>) => {
      setStepData((previous) => ({ ...previous, ...patch }));
      void queryClient.invalidateQueries({
        queryKey: CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY,
      });
      setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
    },
    [queryClient, steps.length],
  );

  const resetStepper = useCallback(() => {
    setStepData({});
    setCurrentStepIndex(0);
    setClearsaleSessionIdState(null);
    setSessionSteps(null);
  }, []);

  const goToStep = useCallback(
    (stepId: CheckoutStepId) => {
      const index = steps.indexOf(stepId);
      if (index >= 0) {
        setCurrentStepIndex(index);
      }
    },
    [steps],
  );

  return {
    steps,
    currentStep,
    currentStepIndex,
    stepData,
    clearsaleSessionId,
    setClearsaleSessionId,
    ensureClearsaleSessionId,
    requirements,
    needsCard: requirements.needs_card,
    isLoadingRequirements: requirementsQuery.isLoading,
    requirementsError: requirementsQuery.error?.message ?? null,
    goNext,
    goBack,
    goToStep,
    updateStepData,
    completeStep,
    resetStepper,
    canGoBack: currentStepIndex > 0,
    canGoNext: currentStepIndex < steps.length - 1,
    isLastStep: currentStepIndex === steps.length - 1,
  };
}
