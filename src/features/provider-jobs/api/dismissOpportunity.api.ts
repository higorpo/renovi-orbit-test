import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";

export interface DismissProviderOpportunityResult {
  success: boolean;
}

export interface DismissProviderOpportunityResponse {
  data: DismissProviderOpportunityResult | null;
  error: string | null;
}

export async function dismissProviderOpportunity(
  serviceRequestId: string,
): Promise<DismissProviderOpportunityResponse> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID da oportunidade é obrigatório" };
  }

  const { data, error } = await supabase.rpc("dismiss_provider_opportunity", {
    p_service_request_id: id,
  });

  if (error) {
    logger.error("dismiss_provider_opportunity_error", {
      serviceRequestId: id,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  const payload = data as { success?: boolean } | null;
  return {
    data: { success: payload?.success !== false },
    error: null,
  };
}
