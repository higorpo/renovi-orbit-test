import { useCallback } from "react";
import { toast } from "sonner";
import { stepAddressSchema } from "../components/RequestQuote/schemas";
import type { ServiceWithChildren } from "../types/request-quote.types";
import type { RequestQuoteState } from "./useRequestQuoteState";

export interface UseRequestQuoteNavigationParams {
  state: RequestQuoteState;
  user: { id: string } | null;
  onSubmitLoggedIn: () => Promise<void>;
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
}: UseRequestQuoteNavigationParams): UseRequestQuoteNavigationResult {
  const totalSteps = user ? 4 : 5;

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
          const result = stepAddressSchema.safeParse(state.step4Data.formData);
          if (!result.success) {
            toast.error(result.error.issues[0].message);
            return;
          }
        }
        await onSubmitLoggedIn();
        return;
      }
      if (!state.step4Data || state.step4Data.kind !== "new") {
        toast.error("Preencha o endereço.");
        return;
      }
      const result = stepAddressSchema.safeParse(state.step4Data.formData);
      if (!result.success) {
        toast.error(result.error.issues[0].message);
        return;
      }
    }
    state.setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  }, [state, user, totalSteps, onSubmitLoggedIn]);

  const handleBack = useCallback(() => {
    state.setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, [state]);

  const handleServiceSelect = useCallback(
    (service: ServiceWithChildren) => {
      state.setSelectedService(service);
      state.setStep2Data({});
      state.setStep2FormSchema(null);
      state.setStep2FormVersion(null);
      state.setCurrentStep(2);
    },
    [state]
  );

  return {
    handleNext,
    handleBack,
    handleServiceSelect,
    totalSteps,
  };
}
