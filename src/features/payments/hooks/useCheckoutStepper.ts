import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CheckoutStepData,
  CheckoutStepId,
} from "../types/checkoutStepper.types";
import { generateClearSaleSessionId } from "../utils/generateClearSaleSessionId";
import { resolveCheckoutSteps } from "../utils/resolveCheckoutSteps";
import {
  CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY,
  useCheckoutStepRequirements,
} from "./useCheckoutStepRequirements";

export type UseCheckoutStepperOptions = {
  enabled?: boolean;
};

export type UseCheckoutStepperResult = ReturnType<typeof useCheckoutStepper>;

export function useCheckoutStepper(options: UseCheckoutStepperOptions = {}) {
  const queryClient = useQueryClient();
  const [stepData, setStepData] = useState<CheckoutStepData>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [clearsaleSessionId, setClearsaleSessionIdState] = useState<string | null>(null);
  const [sessionSteps, setSessionSteps] = useState<CheckoutStepId[] | null>(null);

  const requirementsQuery = useCheckoutStepRequirements({
    enabled: options.enabled !== false,
  });

  const requirements = requirementsQuery.requirements;

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

  const refetchRequirements = useCallback(() => {
    void requirementsQuery.refetch();
  }, [requirementsQuery.refetch]);

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
    requirementsError: requirementsQuery.error,
    refetchRequirements,
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
