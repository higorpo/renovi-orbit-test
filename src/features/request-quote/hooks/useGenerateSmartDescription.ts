import { useCallback } from "react";
import { toast } from "sonner";
import { useAnalytics } from "@/hooks/useAnalytics";
import { logger } from "@/lib/logger";
import { addBreadcrumb, metrics } from "@/lib/sentry";
import { invokeGenerateSmartDescription } from "../api/smartDescription.api";
import type { RequestQuoteState } from "./useRequestQuoteState";
import type { GenerateSmartDescriptionPayload } from "../types/request-quote.types";

export interface UseGenerateSmartDescriptionParams {
  state: RequestQuoteState;
  /** Called after description and structured data are set successfully. Used to track step2Data snapshot. */
  onSuccess?: () => void;
  /** Called when generation fails; allows caller to clear snapshot so user can retry. */
  onFailure?: () => void;
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
  onSuccess,
  onFailure,
}: UseGenerateSmartDescriptionParams): UseGenerateSmartDescriptionResult {
  const { trackEvent } = useAnalytics();
  const generateSmartDescription = useCallback(async () => {
    state.setGeneratingDescription(true);
    try {
      const additionalDetails = getAdditionalDetailsFromStep2(state.step2Data);
      const payload: GenerateSmartDescriptionPayload = {
        serviceId: state.selectedService?.id ?? "",
        formData: state.step2Data,
        formSchema: state.step2FormSchema ?? undefined,
        userNotes: additionalDetails ?? undefined,
        mode: "full_description" as const,
        useStructuredOutput: true,
      };
      const { data, error } = await invokeGenerateSmartDescription(payload);
      if (error) {
        logger.error("request_quote_smart_description_api_error", {
          error: error.message,
          serviceId: state.selectedService?.id,
        });
        throw error;
      }
      if (data?.description) {
        state.setStep3Data((prev) => ({
          ...prev,
          description: data.description!,
          structured: data.structured
            ? {
                urgency: data.structured.urgency,
                scope_complexity: data.structured.scope_complexity,
                suggested_questions: data.structured.suggested_questions,
                tags: data.structured.tags,
                missing_info_warnings: data.structured.missing_info_warnings,
                suggested_equipment: data.structured.suggested_equipment,
                suggested_materials: data.structured.suggested_materials,
                estimated_duration_hint: data.structured.estimated_duration_hint,
              }
            : undefined,
        }));
      } else {
        logger.warn("request_quote_smart_description_empty_response", {
          serviceId: state.selectedService?.id,
        });
        throw new Error("Descrição não retornada");
      }
      addBreadcrumb({
        message: "request_quote.smart_description_generated",
        data: { serviceId: state.selectedService?.id },
      });
      metrics.count("request_quote.smart_description_generated", 1);
      trackEvent("smart_description_used", {
        ...(state.selectedService?.slug && { service_slug: state.selectedService.slug }),
      });
      toast.success("Descrição gerada com sucesso! Você pode editar se quiser.");
      onSuccess?.();
    } catch (err) {
      logger.error("request_quote_smart_description_failed", {
        error: err instanceof Error ? err.message : String(err),
        serviceId: state.selectedService?.id,
      });
      addBreadcrumb({
        message: "request_quote.smart_description_failed",
        level: "warning",
        data: { serviceId: state.selectedService?.id },
      });
      onFailure?.();
      toast.error(
        "Não foi possível gerar a descrição automaticamente. Descreva o serviço manualmente.",
        { duration: 5000 }
      );
    } finally {
      state.setGeneratingDescription(false);
    }
  }, [state, onSuccess, onFailure, trackEvent]);

  return { generateSmartDescription };
}
