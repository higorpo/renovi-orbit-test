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
      ...payload,
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
