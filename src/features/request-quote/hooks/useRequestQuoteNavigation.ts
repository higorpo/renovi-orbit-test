import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { addressFormSchema } from "@/features/addresses";
import type { ServiceWithChildren } from "../types/request-quote.types";
import type { RequestQuoteState } from "./useRequestQuoteState";

export interface UseRequestQuoteNavigationParams {
  state: RequestQuoteState;
  user: { id: string } | null;
  onSubmitLoggedIn: () => Promise<void>;
  /** Optional service slug from URL (?serviceSlug=) for quote_request_started */
  urlServiceSlug?: string | null;
}

export interface UseRequestQuoteNavigationResult {
  handleNext: () => Promise<void>;
  handleBack: () => void;
  handleServiceSelect: (service: ServiceWithChildren) => void;
  totalSteps: number;
}

export function useRequestQuoteNavigation({
  state,
  user,
  onSubmitLoggedIn,
  urlServiceSlug = null,
}: UseRequestQuoteNavigationParams): UseRequestQuoteNavigationResult {
  const { trackEvent } = useAnalytics();
  const totalSteps = user ? 4 : 5;
  const hasTrackedStartedRef = useRef(false);

  useEffect(() => {
    if (state.currentStep !== 1 || hasTrackedStartedRef.current) return;
    hasTrackedStartedRef.current = true;
    trackEvent("quote_request_started", {
      is_logged_in: !!user,
      ...(urlServiceSlug && { service_slug: urlServiceSlug }),
    });
  }, [state.currentStep, user, urlServiceSlug, trackEvent]);

  const handleNext = useCallback(async () => {
    if (state.currentStep === 1) {
      if (!state.selectedService) {
        toast.error("Selecione um serviço para continuar.");
        return;
      }
    }
    if (state.currentStep === 2) {
      if (Object.keys(state.step2Data).length === 0) {
        toast.error("Preencha os campos do formulário do serviço para continuar.");
        return;
      }
      trackEvent("quote_request_step_completed", {
        step: 2,
        is_logged_in: !!user,
        total_steps: totalSteps,
      });
      state.setCurrentStep(3);
      return;
    }
    if (state.currentStep === 3) {
      if (!state.step3Data.description.trim()) {
        toast.error("Adicione uma descrição do serviço.");
        return;
      }
    }
    if (state.currentStep === 4) {
      if (user) {
        if (!state.step4Data) {
          toast.error("Selecione um endereço ou cadastre um novo.");
          return;
        }
        if (state.step4Data.kind === "new") {
          const result = addressFormSchema.safeParse(state.step4Data.formData);
          if (!result.success) {
            toast.error(result.error.issues[0].message);
            return;
          }
        }
        trackEvent("quote_request_step_completed", {
          step: 4,
          is_logged_in: true,
          total_steps: totalSteps,
        });
        await onSubmitLoggedIn();
        return;
      }
      if (!state.step4Data || state.step4Data.kind !== "new") {
        toast.error("Preencha o endereço.");
        return;
      }
      const result = addressFormSchema.safeParse(state.step4Data.formData);
      if (!result.success) {
        toast.error(result.error.issues[0].message);
        return;
      }
    }
    trackEvent("quote_request_step_completed", {
      step: state.currentStep,
      is_logged_in: !!user,
      total_steps: totalSteps,
    });
    state.setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  }, [state, user, totalSteps, onSubmitLoggedIn, trackEvent]);

  const handleBack = useCallback(() => {
    state.setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, [state]);

  const handleServiceSelect = useCallback(
    (service: ServiceWithChildren) => {
      trackEvent("service_selected", {
        service_id: service.id,
        service_slug: service.slug,
      });
      state.setSelectedService(service);
      state.setStep2Data({});
      state.setStep2FormSchema(null);
      state.setStep2FormVersion(null);
      state.setCurrentStep(2);
    },
    [state, trackEvent]
  );

  return {
    handleNext,
    handleBack,
    handleServiceSelect,
    totalSteps,
  };
}
