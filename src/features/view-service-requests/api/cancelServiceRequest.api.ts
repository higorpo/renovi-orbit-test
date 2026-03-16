import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export interface CancelServiceRequestParams {
  id: string;
  clientId: string;
}

export interface CancelServiceRequestResult {
  error: string | null;
}

/**
 * Cancel a service request (set status to 'cancelled').
 * Only allowed for the owning client. RLS enforces client_id match on update.
 */
export async function cancelServiceRequest(
  params: CancelServiceRequestParams
): Promise<CancelServiceRequestResult> {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid || uid !== params.clientId) {
    logger.warn("view_service_requests_cancel_unauthorized", {
      requestId: params.id,
      clientId: params.clientId,
    });
    return { error: "Não autorizado" };
  }

  const { error } = await supabase
    .from("service_requests")
    .update({ status: "cancelled" })
    .eq("id", params.id)
    .eq("client_id", params.clientId);

  if (error) {
    logger.error("view_service_requests_cancel_error", {
      requestId: params.id,
      clientId: params.clientId,
      error: error.message,
    });
    return { error: error.message };
  }

  return { error: null };
}
