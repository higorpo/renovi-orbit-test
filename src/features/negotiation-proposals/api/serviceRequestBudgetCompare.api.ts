import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type { ServiceRequestBudgetCompareDetail } from "../types/serviceRequestBudgetCompare.types";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function fetchServiceRequestBudgetCompareDetail(serviceRequestId: string): Promise<{
  data: ServiceRequestBudgetCompareDetail | null;
  error: string | null;
}> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("get_client_budget_service_request_detail", {
    p_service_request_id: serviceRequestId,
  });
  if (error) {
    logger.error("fetch_service_request_budget_compare_detail_error", {
      error: error.message,
      serviceRequestId,
    });
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== "object") {
    logger.error("fetch_service_request_budget_compare_detail_invalid_response", {
      data,
      serviceRequestId,
    });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as ServiceRequestBudgetCompareDetail, error: null };
}

export async function rejectServiceRequestBudgetProposal(params: {
  proposalId: string;
  reason: string;
}) {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("reject_client_budget_proposal", {
    p_proposal_id: params.proposalId,
    p_reason: params.reason,
  });
  if (error) {
    logger.error("reject_service_request_budget_proposal_error", {
      error: error.message,
      proposalId: params.proposalId,
    });
    return { error: error.message, data: null as unknown };
  }
  return { error: null, data };
}
