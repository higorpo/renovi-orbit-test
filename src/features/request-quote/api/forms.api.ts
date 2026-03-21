import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { FormRow } from "../types/request-quote.types";

export interface GetFormByIdResult {
  form: FormRow | null;
  error: string | null;
}

export async function getFormById(formId: string): Promise<GetFormByIdResult> {
  const { data, error } = await supabase
    .from("platform_forms")
    .select("*")
    .eq("id", formId)
    .maybeSingle();

  if (error) {
    logger.error("request_quote_form_fetch_error", { formId, error: error.message });
    return { form: null, error: error.message };
  }
  return { form: data as FormRow | null, error: null };
}
