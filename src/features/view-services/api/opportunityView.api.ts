import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";

export interface RecordProviderOpportunityViewResult {
  success: boolean;
}

export async function recordProviderOpportunityView(
  serviceRequestId: string,
): Promise<{ data: RecordProviderOpportunityViewResult | null; error: string | null }> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID da oportunidade é obrigatório" };
  }

  const { data, error } = await supabase.rpc("record_provider_opportunity_view", {
    p_service_request_id: id,
  });

  if (error) {
    logger.error("record_provider_opportunity_view_error", {
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
