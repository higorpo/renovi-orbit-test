import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type {
  ClientBudgetDetail,
  ClientReceivedServiceGroup,
  PaginatedResponse,
} from "../types/client-budgets.types";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function isPaginatedResponse(value: unknown): value is PaginatedResponse<unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.items) &&
    typeof v.total_count === "number" &&
    typeof v.page === "number" &&
    typeof v.page_size === "number"
  );
}

export async function fetchClientReceivedBudgets(params: {
  page: number;
  pageSize: number;
  status: string | null;
  search: string | null;
}): Promise<{ data: PaginatedResponse<ClientReceivedServiceGroup> | null; error: string | null }> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("list_client_received_budgets", {
    p_page: params.page,
    p_page_size: params.pageSize,
    p_status: params.status,
    p_search: params.search,
  });

  if (error) {
    logger.error("fetch_client_received_budgets_error", { error: error.message });
    return { data: null, error: error.message };
  }
  if (!isPaginatedResponse(data)) {
    logger.error("fetch_client_received_budgets_invalid_response", { data });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as PaginatedResponse<ClientReceivedServiceGroup>, error: null };
}

export async function fetchClientBudgetDetail(serviceRequestId: string): Promise<{
  data: ClientBudgetDetail | null;
  error: string | null;
}> {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("get_client_budget_service_request_detail", {
    p_service_request_id: serviceRequestId,
  });
  if (error) {
    logger.error("fetch_client_budget_detail_error", { error: error.message, serviceRequestId });
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== "object") {
    logger.error("fetch_client_budget_detail_invalid_response", { data, serviceRequestId });
    return { data: null, error: "Unexpected response from server" };
  }
  return { data: data as ClientBudgetDetail, error: null };
}

export async function rejectClientBudgetProposal(params: { proposalId: string; reason: string }) {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("reject_client_budget_proposal", {
    p_proposal_id: params.proposalId,
    p_reason: params.reason,
  });
  if (error) {
    logger.error("reject_client_budget_proposal_error", {
      error: error.message,
      proposalId: params.proposalId,
    });
    return { error: error.message, data: null as unknown };
  }
  return { error: null, data };
}
