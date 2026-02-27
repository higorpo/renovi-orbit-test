import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  GenerateSmartDescriptionPayload,
  GenerateSmartDescriptionResponse,
} from "../types/request-quote.types";

export interface InvokeGenerateSmartDescriptionResult {
  data: GenerateSmartDescriptionResponse | null;
  error: Error | null;
}

export async function invokeGenerateSmartDescription(
  payload: GenerateSmartDescriptionPayload
): Promise<InvokeGenerateSmartDescriptionResult> {
  const { data, error } = await supabase.functions.invoke("generate-smart-description", {
    body: {
      service: payload.serviceId,
      formData: payload.formData,
      userNotes: payload.userNotes ?? "",
      requestId: payload.requestId ?? null,
      mode: payload.mode,
      useStructuredOutput: payload.useStructuredOutput,
      city: payload.city ?? null,
      neighborhood: payload.neighborhood ?? null,
      state: payload.state ?? null,
    },
  });

  if (error) {
    logger.error("request_quote_generate_smart_description_error", {
      error: error.message,
      serviceId: payload.serviceId,
    });
    return { data: null, error };
  }

  const typed = data as GenerateSmartDescriptionResponse | null;
  return { data: typed, error: null };
}
