import { useCallback } from "react";
import { toast } from "sonner";
import { invokeGenerateSmartDescription } from "../api/smartDescription.api";
import type { RequestQuoteState } from "./useRequestQuoteState";

export interface UseGenerateSmartDescriptionParams {
  state: RequestQuoteState;
}

export interface UseGenerateSmartDescriptionResult {
  generateSmartDescription: () => Promise<void>;
}

/** Extracts optional additional details from step2 form data for the AI context. */
function getAdditionalDetailsFromStep2(step2Data: Record<string, unknown>): string | null {
  const keys = ["additional_details", "detalhes", "observacoes", "observações"];
  for (const key of keys) {
    const v = step2Data[key];
    if (v && typeof v === "string" && (v as string).trim()) {
      return (v as string).trim();
    }
  }
  return null;
}

export function useGenerateSmartDescription({
  state,
}: UseGenerateSmartDescriptionParams): UseGenerateSmartDescriptionResult {
  const generateSmartDescription = useCallback(async () => {
    state.setGeneratingDescription(true);
    try {
      const additionalDetails = getAdditionalDetailsFromStep2(state.step2Data);
      const payload = {
        serviceId: state.selectedService?.id ?? "",
        formData: state.step2Data,
        userNotes: additionalDetails ?? undefined,
        mode: "full_description" as const,
        useStructuredOutput: true,
        city:
          state.step4Data?.kind === "existing"
            ? state.step4Data.city
            : state.step4Data?.kind === "new"
              ? state.step4Data.formData.address_city || null
              : null,
        neighborhood:
          state.step4Data?.kind === "existing"
            ? state.step4Data.neighborhood
            : state.step4Data?.kind === "new"
              ? state.step4Data.formData.address_neighborhood || null
              : null,
        state:
          state.step4Data?.kind === "existing"
            ? state.step4Data.state
            : state.step4Data?.kind === "new"
              ? state.step4Data.formData.address_state || null
              : null,
      };
      const { data, error } = await invokeGenerateSmartDescription(payload);
      if (error) throw error;
      if (data?.description) {
        state.setStep3Data((prev) => ({ ...prev, description: data.description! }));
      } else {
        throw new Error("Descrição não retornada");
      }
      toast.success("Descrição gerada com sucesso! Você pode editar se quiser.");
    } catch {
      toast.error(
        "Não foi possível gerar a descrição automaticamente. Descreva o serviço manualmente.",
        { duration: 5000 }
      );
    } finally {
      state.setGeneratingDescription(false);
    }
  }, [state]);

  return { generateSmartDescription };
}
